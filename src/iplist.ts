import * as core from '@actions/core'
import * as readline from 'readline'
import * as fs from 'fs'
import * as ipaddress from 'ip-address'
import {BigInteger as JsbnBigInteger} from 'jsbn'

// types
interface IPNetwork4 extends ipaddress.Address4 {
    version?: 4
}

interface IPNetwork6 extends ipaddress.Address6 {
    version?: 6
}

export type IPNetwork = IPNetwork4 | IPNetwork6

interface IPNetworkInterval {
    version: IPNetwork['version']
    start: JsbnBigInteger
    end: JsbnBigInteger
}

// utilities
export function ip_network(network: string): IPNetwork {
    try {
        const result: IPNetwork = new ipaddress.Address4(network)
        result.version = 4
        return result
    } catch {
        // ignore, if this is not a valid IPv4 we will try with IPv6
    }

    try {
        const result: IPNetwork = new ipaddress.Address6(network)
        result.version = 6
        return result
    } catch {
        // ignore, if this is not even a valid IPv6 we throw an error down below
    }

    throw new TypeError('String is not a valid v4 or v6 network')
}

// XXX this should become a method
export function ipnetworkRepr(network: IPNetwork): string {
    if (network.version === 4) {
        return `${network.correctForm()}/${network.subnetMask}`
    }
    if (network.version === 6) {
        return `${network.correctForm()}${network.zone ? network.zone : ''}/${
            network.subnetMask
        }`
    }

    throw new TypeError('Unknown version')
}

// XXX this one too
function ipnetworkCmp(a: IPNetwork, b: IPNetwork): number {
    if (a.version !== b.version) {
        throw new TypeError('Comparing different IPNetwork versions')
    }

    const aBi = a.bigInteger()
    const bBi = b.bigInteger()
    const biComparison = aBi.compareTo(bBi)
    if (biComparison !== 0) {
        return biComparison
    }

    return a.subnetMask - b.subnetMask
}

function ipnetworkFromBigInteger(
    version: number,
    a: JsbnBigInteger,
    mask?: number
): IPNetwork {
    if (version !== 4 && version !== 6) {
        throw new TypeError('Unknown version')
    }

    if (version === 6) {
        const result: IPNetwork = ipaddress.Address6.fromBigInteger(a)
        result.version = 6
        if (typeof mask !== 'undefined') {
            result.subnetMask = mask
        }

        return result
    }

    const result: IPNetwork = ipaddress.Address4.fromBigInteger(a)
    result.version = 4
    if (typeof mask !== 'undefined') {
        result.subnetMask = mask
    }

    return result
}

function ipnetworkintervalSummarize(i: IPNetworkInterval): IPNetwork[] {
    if (typeof i.version === 'undefined') {
        throw new TypeError('Unknown version')
    }

    const start = ipnetworkFromBigInteger(i.version, i.start)
    const end = ipnetworkFromBigInteger(i.version, i.end)

    return summarize(start, end)
}

// XXX - this should not be exported
export function countRighthandZeroBits(
    n: JsbnBigInteger,
    bits: number
): number {
    const first1Bit = n.getLowestSetBit()
    if (first1Bit === -1) {
        // zero
        return bits
    }
    return Math.min(first1Bit, bits)
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
        } catch {
            core.warning(
                `Line "${trimmedLine.slice(0, 16)}${
                    trimmedLine.length > 16 ? '...' : ''
                }" is not a valid IP network`
            )
        }
    }
}

export async function write(path: string, list: IPNetwork[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const wstream = fs.createWriteStream(path, {
            flags: 'w+',
            encoding: 'utf-8'
        })

        for (const entry of list) {
            wstream.write(ipnetworkRepr(entry))
            wstream.write('\n')
        }
        wstream.end()

        wstream.on('finish', () => resolve('OK'))
        wstream.on('error', reject)
    })
}

export function supernet(net: IPNetwork): IPNetwork {
    const temp = net.startAddress()
    let subnetMask = net.subnetMask
    if (subnetMask !== 0) {
        subnetMask -= 1
    }
    temp.subnetMask = subnetMask

    const netResult: IPNetwork = temp.startAddress()
    netResult.subnetMask = subnetMask
    netResult.version = net.version

    return netResult
}

export function collapse(networks: IPNetwork[]): IPNetwork[] {
    // quick check on network versions
    if (networks.length === 0) {
        return []
    }
    for (const n of networks) {
        if (n.version !== networks[0].version) {
            throw new TypeError('Different IPNetwork versions in collapse')
        }
    }

    const to_merge: IPNetwork[] = []
    Object.assign(to_merge, networks)

    const subnets: Map<string, IPNetwork> = new Map()

    while (to_merge.length !== 0) {
        const cnet = to_merge.pop()
        if (typeof cnet === 'undefined') {
            break
        }

        const csupernet = supernet(cnet)
        const csupernetRepr = ipnetworkRepr(csupernet)
        const existing = subnets.get(csupernetRepr)
        if (typeof existing === 'undefined') {
            subnets.set(csupernetRepr, cnet)
        } else if (ipnetworkCmp(existing, cnet) !== 0) {
            subnets.delete(csupernetRepr)
            to_merge.unshift(csupernet)
        }
    }

    const subnetsValue = Array.from(subnets.values()).sort(ipnetworkCmp)

    const thisArg: {last: IPNetwork | undefined} = {last: undefined}
    return subnetsValue.filter(function (
        this: typeof thisArg,
        value: IPNetwork
    ): boolean {
        const cEndAddress = value.endAddress()

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

export function summarize(
    startAddress: IPNetwork,
    endAddress: IPNetwork
): IPNetwork[] {
    if (startAddress.version !== endAddress.version) {
        throw new TypeError('Different IPNetwork versions in summarize')
    }
    if (startAddress.version !== 4 && startAddress.version !== 6) {
        throw new TypeError('Unknown IP version')
    }
    const ipBits = startAddress.version === 6 ? 128 : 32
    if (
        startAddress.subnetMask !== ipBits ||
        endAddress.subnetMask !== ipBits
    ) {
        throw new TypeError('start and end must be IP addresses, not networks')
    }
    if (ipnetworkCmp(startAddress, endAddress) > 0) {
        throw new TypeError('end IP address should be greater than start')
    }

    const result: IPNetwork[] = []

    let startBi = startAddress.bigInteger()
    const endBi = endAddress.bigInteger()

    while (startBi.compareTo(endBi) <= 0) {
        const nBits = Math.min(
            countRighthandZeroBits(startBi, ipBits),
            endBi.subtract(startBi).add(JsbnBigInteger.ONE).bitLength() - 1
        )

        result.push(
            ipnetworkFromBigInteger(
                startAddress.version,
                startBi,
                ipBits - nBits
            )
        )

        startBi = startBi.add(JsbnBigInteger.ONE.shiftLeft(nBits))

        if (startBi.subtract(JsbnBigInteger.ONE).bitCount() === ipBits) {
            break
        }
    }

    return result
}

export function filter(
    list: IPNetwork[],
    filterList: IPNetwork[]
): {result: IPNetwork[]; delta: IPNetwork[]} {
    if (filter.length === 0) {
        return {result: list, delta: []}
    }

    let result: IPNetwork[] = []
    let delta: IPNetwork[] = []

    const filterIntervals: IPNetworkInterval[] = filterList
        .map(net => {
            return {
                version: net.version,
                start: net._startAddress(),
                end: net._endAddress()
            }
        })
        .sort((a, b) => a.start.compareTo(b.start))

    for (const entry of list) {
        if (typeof entry.version === 'undefined') {
            throw new TypeError('Invalid vesion')
        }

        let toFilter: IPNetworkInterval | null = {
            version: entry.version,
            start: entry._startAddress(),
            end: entry._endAddress()
        }
        let summarized: IPNetwork[]
        let filtered: IPNetwork[]

        for (const cfi of filterIntervals) {
            if (cfi.version !== toFilter.version) {
                continue
            }

            if (cfi.end.compareTo(toFilter.start) < 0) {
                continue
            }
            if (cfi.start.compareTo(toFilter.end) > 0) {
                break
            }

            const dStart = cfi.start.subtract(toFilter.start)
            const dEnd = cfi.end.subtract(toFilter.end)

            if (dStart.signum() > 0) {
                summarized = ipnetworkintervalSummarize({
                    start: toFilter.start,
                    end: toFilter.start
                        .add(dStart)
                        .subtract(JsbnBigInteger.ONE),
                    version: entry.version
                })
                result = result.concat(summarized)

                if (dEnd.signum() < 0) {
                    filtered = ipnetworkintervalSummarize(cfi)
                    delta = delta.concat(filtered)

                    toFilter.start = cfi.end.add(JsbnBigInteger.ONE)
                } else {
                    filtered = ipnetworkintervalSummarize({
                        start: cfi.start,
                        end: toFilter.end,
                        version: entry.version
                    })
                    delta = delta.concat(filtered)

                    toFilter = null
                    break
                }
            } else {
                if (dEnd.signum() < 0) {
                    filtered = ipnetworkintervalSummarize({
                        start: toFilter.start,
                        end: cfi.end,
                        version: entry.version
                    })
                    delta = delta.concat(filtered)

                    toFilter.start = cfi.end.add(JsbnBigInteger.ONE)
                } else {
                    filtered = ipnetworkintervalSummarize(toFilter)
                    delta = delta.concat(filtered)

                    toFilter = null
                    break
                }
            }
        }

        if (toFilter !== null) {
            result = result.concat(ipnetworkintervalSummarize(toFilter))
        }
    }

    result = collapse(result.filter(n => n.version === 4)).concat(
        collapse(result.filter(n => n.version === 6))
    )
    delta = collapse(delta.filter(n => n.version === 4)).concat(
        collapse(delta.filter(n => n.version === 6))
    )
    return {result, delta}
}
