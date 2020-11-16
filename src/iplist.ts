import * as readline from 'readline'
import * as fs from 'fs'
import * as ipaddress from 'ip-address'

// types
interface IPNetwork4 extends ipaddress.Address4 {
    version?: 4
}

interface IPNetwork6 extends ipaddress.Address6 {
    version?: 6
}

export type IPNetwork = IPNetwork4 | IPNetwork6

// utilities
export function ip_network(network: string) {
    try {
        let result: IPNetwork = new ipaddress.Address4(network)
        result.version = 4
        return result
    } catch {}

    try {
        let result: IPNetwork = new ipaddress.Address6(network)
        result.version = 6
        return result
    } catch {}

    throw new TypeError('String is not a valid v4 or v6 network')
}

export function ipnetworkRepr(network: IPNetwork): string {
    if (network.version === 4) {
        return `${network.correctForm()}/${network.subnetMask}`
    }
    if (network.version == 6) {
        return `${network.correctForm()}${network.zone ? network.zone : ''}/${
            network.subnetMask
        }`
    }

    throw new TypeError('Unknown version')
}

function ipnetworkCmp(a: IPNetwork, b: IPNetwork): number {
    if (a.version !== b.version) {
        throw new TypeError('Comparing different IPNetwork versions')
    }

    let aBi = a.bigInteger()
    let bBi = b.bigInteger()
    let biComparison = aBi.compareTo(bBi)
    if (biComparison !== 0) {
        return biComparison
    }

    return a.subnetMask - b.subnetMask
}

// real stuff
export async function* read(
    path: string
): AsyncGenerator<IPNetwork, void, void> {
    const fileStream = fs.createReadStream(path, 'utf-8')
    const readLine = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })

    for await (const line of readLine) {
        if (line.startsWith('#')) {
            continue
        }

        const trimmedLine = line.trim()

        try {
            yield ip_network(trimmedLine)
        } catch {}
    }
}

export function supernet(net: IPNetwork): IPNetwork {
    let temp = net.startAddress()
    let subnetMask = net.subnetMask
    if (subnetMask != 0) {
        subnetMask -= 1
    }
    temp.subnetMask = subnetMask

    let netResult: IPNetwork = temp.startAddress()
    netResult.subnetMask = subnetMask
    netResult.version = net.version

    return netResult
}

export function collapse(networks: IPNetwork[]): IPNetwork[] {
    // quick check on network versions
    if (networks.length === 0) {
        return []
    }
    for (let n of networks) {
        if (n.version !== networks[0].version) {
            throw new TypeError('Different IPNetwork versions')
        }
    }

    let to_merge: IPNetwork[] = []
    Object.assign(to_merge, networks)

    let subnets: Map<string, IPNetwork> = new Map()

    while (to_merge.length !== 0) {
        let cnet = to_merge.pop()
        if (typeof cnet === 'undefined') {
            break
        }

        let csupernet = supernet(cnet)
        let csupernetRepr = ipnetworkRepr(csupernet)
        let existing = subnets.get(csupernetRepr)
        if (typeof existing === 'undefined') {
            subnets.set(csupernetRepr, cnet)
        } else if (ipnetworkCmp(existing, cnet) !== 0) {
            subnets.delete(csupernetRepr)
            to_merge.unshift(csupernet)
        }
    }

    let subnetsValue = Array.from(subnets.values()).sort(ipnetworkCmp)

    let thisArg: {last: IPNetwork | undefined} = {last: undefined}
    return subnetsValue.filter(function (
        this: typeof thisArg,
        value: IPNetwork
    ): boolean {
        let cEndAddress = value.endAddress()

        if (typeof this.last !== 'undefined') {
            if (ipnetworkCmp(this.last, cEndAddress) >= 0) {
                return false
            }
        }

        this.last = cEndAddress

        return true
    },
    thisArg)
}
