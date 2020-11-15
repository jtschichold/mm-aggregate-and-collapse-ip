import * as readline from 'readline'
import * as fs from 'fs'
import * as ipaddress from 'ip-address'

interface IPNetwork4 extends ipaddress.Address4 {
    version?: 4;
}

interface IPNetwork6 extends ipaddress.Address6 {
    version?: 6;
}

type IPNetwork = IPNetwork4 | IPNetwork6

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
      let v4address: IPNetwork4 = new ipaddress.Address4(trimmedLine)
      v4address.version = 4
      yield v4address
      continue
    } catch {}

    try {
      let v6address: IPNetwork6 = new ipaddress.Address6(trimmedLine)
      yield v6address
      continue
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

  let netResult = temp.startAddress()
  netResult.subnetMask = subnetMask

  return netResult
}

export function collapse(networks: IPNetwork[]): IPNetwork[] {
    return []
}