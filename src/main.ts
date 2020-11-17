import * as core from '@actions/core'
import * as glob from '@actions/glob'
import * as path from 'path'
import * as tmp from 'tmp'
import * as iplist from './iplist'
import * as reservedIPs from './reservedips'

interface ActionInputs {
    list: string
    listGlobOptions: glob.GlobOptions
    initval?: string
    filter?: string
    filterReservedIPs?: boolean
    filterOptions: iplist.FilterOptions
    tmpTemplate: string
}

function parseInputs(): ActionInputs {
    const result: ActionInputs = {
        list: core.getInput('list', {required: true}),
        listGlobOptions: {
            followSymbolicLinks:
                core.getInput('followSymbolicLinks').toUpperCase() !== 'FALSE'
        },
        filterOptions: {
            minV4SubnetMask: 8,
            minV6SubnetMask: 8
        },
        tmpTemplate: './temp/XXXXXX'
    }

    const initval: string = core.getInput('initval')
    if (initval) result.initval = initval

    const filter: string = core.getInput('filter')
    if (filter) result.filter = filter

    const filterReservedIPs: string = core.getInput('filterReservedIps')
    if (filterReservedIPs && filterReservedIPs.toUpperCase() !== 'FALSE')
        result.filterReservedIPs = true

    const minIPv6Mask: string = core.getInput('minIPv6Mask')
    if (minIPv6Mask)
        result.filterOptions.minV6SubnetMask = parseInt(minIPv6Mask)

    const minIPv4Mask: string = core.getInput('minIPv4Mask')
    if (minIPv4Mask)
        result.filterOptions.minV4SubnetMask = parseInt(minIPv4Mask)

    const outputDir: string = core.getInput('outputDir')
    if (outputDir) result.tmpTemplate = path.join(outputDir, 'XXXXXX')

    return result
}

async function run(): Promise<void> {
    try {
        const inputs = parseInputs()

        // load the initial list if present
        const initialList: iplist.IPNetwork[] = []

        if (inputs.initval) {
            for await (const ivnet of iplist.read(inputs.initval)) {
                core.info(`Loading initval from ${inputs.initval}...`)
                initialList.push(ivnet)
            }
        }

        // load the additional list
        const globber = await glob.create(inputs.list, inputs.listGlobOptions)
        for await (const lpath of globber.globGenerator()) {
            core.info(`Loading list from ${lpath}...`)
            for await (const nentry of iplist.read(lpath)) {
                initialList.push(nentry)
            }
        }

        // aggregate the list
        core.info('Aggregating and collapsing the list...')
        let result = iplist.collapse(initialList)
        let delta: iplist.IPNetwork[] = []

        // build the filter list
        let filterListV4: iplist.IPNetwork[] = []
        let filterListV6: iplist.IPNetwork[] = []

        // add the reserved IP ranges if needed
        if (inputs.filterReservedIPs) {
            core.info('Loading reserved IPs...')
            filterListV4 = filterListV4.concat(
                reservedIPs.reservedIPv4.map(iplist.ip_network)
            )
            filterListV6 = filterListV6.concat(
                reservedIPs.reservedIPv6.map(iplist.ip_network)
            )
        }

        // add the nets from the file
        if (inputs.filter) {
            core.info(`Loading filter entries from ${inputs.filter}...`)
            for await (const fnet of iplist.read(inputs.filter)) {
                if (fnet.version === 4) {
                    filterListV4.push(fnet)
                    continue
                }
                if (fnet.version === 6) {
                    filterListV6.push(fnet)
                    continue
                }
            }
        }

        filterListV4 = iplist.collapse(filterListV4)
        filterListV6 = iplist.collapse(filterListV6)

        // let's filter (if needed)
        if (
            filterListV4.length !== 0 ||
            filterListV6.length !== 0 ||
            inputs.filterOptions.minV4SubnetMask !== 0 ||
            inputs.filterOptions.minV6SubnetMask !== 0
        ) {
            core.info('Filtering the list...')
            ;({result, delta} = iplist.filter(
                result,
                filterListV4.concat(filterListV6),
                inputs.filterOptions
            ))
        }

        // save my stuff
        core.info('Saving outputs...')
        const deltaPath = tmp.tmpNameSync({
            template: inputs.tmpTemplate,
            tmpdir: '.'
        })
        await iplist.write(deltaPath, delta)

        const resultPath = tmp.tmpNameSync({
            template: inputs.tmpTemplate,
            tmpdir: '.'
        })
        await iplist.write(resultPath, result)

        core.setOutput('result', resultPath)
        core.setOutput('delta', deltaPath)
    } catch (error) {
        core.setFailed(error.message)
    }
}

run()
