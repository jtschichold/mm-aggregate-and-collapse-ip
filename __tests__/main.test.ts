import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as ipaddress from 'ip-address'
import * as iplist from '../src/iplist'

test('test read', async () => {
  let count = 0

  for await (const ipnetwork of iplist.read('./__tests__/test.list')) {
    count += 1
  }

  expect(count).toBe(3)
})

test('test supernet 1', () => {
  const av4 = new ipaddress.Address4('198.51.100.1')
  const supernet = iplist.supernet(av4)

  expect(supernet.startAddress().address).toBe('198.51.100.0')
  expect(supernet.subnetMask).toBe(31)
})

test('test runs', () => {
  process.env['INPUT_LISTS'] = 'test.list'
  const ip = path.join(__dirname, '..', 'lib', 'main.js')
  const options: cp.ExecSyncOptions = {
    env: process.env
  }
  console.log(cp.execSync(`node ${ip}`, options).toString())
})
