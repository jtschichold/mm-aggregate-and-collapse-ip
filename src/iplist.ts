import * as readline from 'readline'
import * as fs from 'fs'
import * as ipaddress from 'ip-address'
import {BigInteger as JsbnBigInteger} from 'jsbn'
import {type} from 'os'

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

// XXX this should become a method
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

// XXX this one too
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

function ipnetworkFromBigInteger(
    version: number,
    a: JsbnBigInteger,
    mask?: number
): IPNetwork {
    if (version !== 4 && version != 6) {
        throw new TypeError('Unknown version')
    }

    if (version === 6) {
        let result: IPNetwork = ipaddress.Address6.fromBigInteger(a)
        result.version = 6
        if (typeof mask !== 'undefined') {
            result.subnetMask = mask
        }

        return result
    }

    let result: IPNetwork = ipaddress.Address4.fromBigInteger(a)
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

    let start = ipnetworkFromBigInteger(i.version, i.start)
    let end = ipnetworkFromBigInteger(i.version, i.end)

    return summarize(start, end)
}

// XXX - this should not be exported
export function countRighthandZeroBits(n: JsbnBigInteger, bits: number) {
    let first1Bit = n.getLowestSetBit()
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

export function summarize(
    startAddress: IPNetwork,
    endAddress: IPNetwork
): IPNetwork[] {
    if (startAddress.version !== endAddress.version) {
        throw new TypeError('Different IPNetwork versions')
    }
    if (startAddress.version !== 4 && startAddress.version !== 6) {
        throw new TypeError('Unknown IP version')
    }
    let ipBits = startAddress.version === 6 ? 128 : 32
    if (
        startAddress.subnetMask !== ipBits ||
        endAddress.subnetMask !== ipBits
    ) {
        throw new TypeError('start and end must be IP addresses, not networks')
    }
    if (ipnetworkCmp(startAddress, endAddress) > 0) {
        throw new TypeError('end IP address should be greater than start')
    }

    let result: IPNetwork[] = []

    let startBi = startAddress.bigInteger()
    let endBi = endAddress.bigInteger()

    while (startBi.compareTo(endBi) <= 0) {
        let nBits = Math.min(
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
    filter: IPNetwork[]
): {result: IPNetwork[]; delta: IPNetwork[]} {
    if (filter.length === 0) {
        return {result: list, delta: []}
    }

    let result: IPNetwork[] = []
    let delta: IPNetwork[] = []

    let collapsedFilter = collapse(filter)
    let filterIntervals: IPNetworkInterval[] = collapsedFilter
        .map(net => {
            return {
                version: net.version,
                start: net._startAddress(),
                end: net._endAddress()
            }
        })
        .sort((a, b) => a.start.compareTo(b.start))

    for (let entry of list) {
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

        for (let cfi of filterIntervals) {
            if (cfi.version !== toFilter.version) {
                continue
            }

            if (cfi.end.compareTo(toFilter.start) < 0) {
                continue
            }
            if (cfi.start.compareTo(toFilter.end) > 0) {
                break
            }

            let dStart = cfi.start.subtract(toFilter.start)
            let dEnd = cfi.end.subtract(toFilter.end)

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

    return {result, delta}
}
