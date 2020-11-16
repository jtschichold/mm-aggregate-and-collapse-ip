import * as process from 'process'
import * as cp from 'child_process'
import * as path from 'path'
import * as ipaddress from 'ip-address'
import * as iplist from '../src/iplist'
import {BigInteger as JsbnBigInteger} from 'jsbn'

test('test read', async () => {
    let count = 0

    for await (const ipnetwork of iplist.read('./__tests__/test.list')) {
        count += 1
    }

    expect(count).toBe(3)
})

test('test collapsing', () => {
    let ip1 = iplist.ip_network('1.1.1.0')
    let ip2 = iplist.ip_network('1.1.1.1')
    let ip3 = iplist.ip_network('1.1.1.2')
    let ip4 = iplist.ip_network('1.1.1.3')
    let ip5 = iplist.ip_network('1.1.1.4')
    let ip6 = iplist.ip_network('1.1.1.0')
    // check that addresses are subsumed properly.
    let collapsed = iplist.collapse([ip1, ip2, ip3, ip4, ip5, ip6])
    expect(collapsed).toHaveLength(2)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('1.1.1.0/30')
    expect(iplist.ipnetworkRepr(collapsed[1])).toBe('1.1.1.4/32')

    // test a mix of IP addresses and networks including some duplicates
    ip1 = iplist.ip_network('1.1.1.0')
    ip2 = iplist.ip_network('1.1.1.1')
    ip3 = iplist.ip_network('1.1.1.2')
    ip4 = iplist.ip_network('1.1.1.3')
    // check that addresses are subsumed properly.
    collapsed = iplist.collapse([ip1, ip2, ip3, ip4])
    expect(collapsed).toHaveLength(1)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('1.1.1.0/30')

    // test only IP networks
    ip1 = iplist.ip_network('1.1.0.0/24')
    ip2 = iplist.ip_network('1.1.1.0/24')
    ip3 = iplist.ip_network('1.1.2.0/24')
    ip4 = iplist.ip_network('1.1.3.0/24')
    ip5 = iplist.ip_network('1.1.4.0/24')
    // stored in no particular order b/c we want CollapseAddr to call
    // [].sort
    ip6 = iplist.ip_network('1.1.0.0/22')
    // check that addresses are subsumed properly.
    collapsed = iplist.collapse([ip1, ip2, ip3, ip4, ip5, ip6])
    expect(collapsed).toHaveLength(2)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('1.1.0.0/22')
    expect(iplist.ipnetworkRepr(collapsed[1])).toBe('1.1.4.0/24')

    // test that two addresses are supernet'ed properly
    collapsed = iplist.collapse([ip1, ip2])
    expect(collapsed).toHaveLength(1)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('1.1.0.0/23')

    // test same IP networks
    let ip_same1 = iplist.ip_network('1.1.1.1/32')
    let ip_same2 = ip_same1
    collapsed = iplist.collapse([ip_same1, ip_same2])
    expect(collapsed).toHaveLength(1)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('1.1.1.1/32')

    // test same IP addresses
    ip_same1 = iplist.ip_network('1.1.1.1')
    ip_same2 = ip_same1
    collapsed = iplist.collapse([ip_same1, ip_same2])
    expect(collapsed).toHaveLength(1)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('1.1.1.1/32')

    ip1 = iplist.ip_network('2001::/100')
    ip2 = iplist.ip_network('2001::/120')
    ip3 = iplist.ip_network('2001::/96')
    // test that ipv6 addresses are subsumed properly.
    collapsed = iplist.collapse([ip1, ip2, ip3])
    expect(collapsed).toHaveLength(1)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('2001::/96')

    ip1 = iplist.ip_network('2001::%scope/100')
    ip2 = iplist.ip_network('2001::%scope/120')
    ip3 = iplist.ip_network('2001::%scope/96')
    // test that ipv6 addresses are subsumed properly.
    collapsed = iplist.collapse([ip1, ip2, ip3])
    expect(collapsed).toHaveLength(1)
    expect(iplist.ipnetworkRepr(collapsed[0])).toBe('2001::%scope/96')

    // the toejam test
    let addr_tuples = [
        [iplist.ip_network('1.1.1.1'), iplist.ip_network('::1')],
        [iplist.ip_network('1.1.0.0/24'), iplist.ip_network('2001::/120')],
        [iplist.ip_network('1.1.0.0/32'), iplist.ip_network('2001::/128')]
    ]
    for (let tuple of addr_tuples) {
        expect(() => iplist.collapse(tuple)).toThrow(TypeError)
    }

    addr_tuples = [
        [iplist.ip_network('1.1.1.1'), iplist.ip_network('::1%scope')],
        [
            iplist.ip_network('1.1.0.0/24'),
            iplist.ip_network('2001::%scope/120')
        ],
        [iplist.ip_network('1.1.0.0/32'), iplist.ip_network('2001::%scope/128')]
    ]
    for (let tuple of addr_tuples) {
        expect(() => iplist.collapse(tuple)).toThrow(TypeError)
    }
})

test('test summarize', () => {
    let ip1 = iplist.ip_network('1.1.1.0')
    let ip2 = iplist.ip_network('1.1.1.255')

    // summarize works only for IPv4 & IPv6
    let ip_invalid1 = iplist.ip_network('::1')
    ip_invalid1.version = <any>7 // fool type checking
    let ip_invalid2 = iplist.ip_network('::1')
    ip_invalid2.version = <any>7
    expect(() => iplist.summarize(ip_invalid1, ip_invalid2)).toThrow(TypeError)
    expect(() => iplist.summarize(ip1, iplist.ip_network('::1'))).toThrow(
        TypeError
    )
    expect(() => iplist.summarize(ip1, iplist.ip_network('::1%scope'))).toThrow(
        TypeError
    )

    // test a /24 is summarized properly
    let summarized = iplist.summarize(ip1, ip2)
    expect(summarized).toHaveLength(1)
    expect(iplist.ipnetworkRepr(summarized[0])).toBe('1.1.1.0/24')

    // test an IPv4 range that isn't on a network byte boundary
    ip2 = iplist.ip_network('1.1.1.8')
    summarized = iplist.summarize(ip1, ip2)
    expect(summarized).toHaveLength(2)
    expect(iplist.ipnetworkRepr(summarized[0])).toBe('1.1.1.0/29')
    expect(iplist.ipnetworkRepr(summarized[1])).toBe('1.1.1.8/32')

    // all!
  ip1 = iplist.ip_network('0.0.0.0')
  ip2 = iplist.ip_network('255.255.255.255')
  summarized = iplist.summarize(ip1, ip2)
  expect(summarized).toHaveLength(1)
  expect(iplist.ipnetworkRepr(summarized[0])).toBe('0.0.0.0/0')

  ip1 = iplist.ip_network('1::')
  ip2 = iplist.ip_network('1:ffff:ffff:ffff:ffff:ffff:ffff:ffff')
  summarized = iplist.summarize(ip1, ip2)
  expect(summarized).toHaveLength(1)
  expect(iplist.ipnetworkRepr(summarized[0])).toBe('1::/16')

  // test an IPv6 range that isn't on a network byte boundary
  ip2 = iplist.ip_network('2::')
  summarized = iplist.summarize(ip1, ip2)
  expect(summarized).toHaveLength(2)
  expect(iplist.ipnetworkRepr(summarized[0])).toBe('1::/16')
  expect(iplist.ipnetworkRepr(summarized[1])).toBe('2::/128')

  ip1 = iplist.ip_network('1::%scope')
  ip2 = iplist.ip_network('1:ffff:ffff:ffff:ffff:ffff:ffff:ffff%scope')
  // test an IPv6 is summarized properly
  summarized = iplist.summarize(ip1, ip2)
  expect(summarized).toHaveLength(1)
  expect(iplist.ipnetworkRepr(summarized[0])).toBe('1::/16')

    // test an IPv6 range that isn't on a network byte boundary
  ip2 = iplist.ip_network('2::%scope')
  summarized = iplist.summarize(ip1, ip2)
  expect(summarized).toHaveLength(2)
  expect(iplist.ipnetworkRepr(summarized[0])).toBe('1::/16')
  expect(iplist.ipnetworkRepr(summarized[1])).toBe('2::/128')


  // test exception raised when first is greater than last
  expect(() => iplist.summarize(iplist.ip_network('1.1.1.0'), iplist.ip_network('1.1.0.0'))).toThrow(TypeError)

  // test exception raised when first and last aren't IP addresses
  expect(() => iplist.summarize(iplist.ip_network('1.1.0.0/24'), iplist.ip_network('1.1.1.0/24'))).toThrow(TypeError)
  expect(() => iplist.summarize(iplist.ip_network('::'), iplist.ip_network('1.1.0.0'))).toThrow(TypeError)
})

test('test supernet 1', () => {
    const av4 = new ipaddress.Address4('198.51.100.1')
    const supernet = iplist.supernet(av4)

    expect(supernet.startAddress().address).toBe('198.51.100.0')
    expect(supernet.subnetMask).toBe(31)
})

test('test countRighthandZeroBits', () => {
    expect(iplist.countRighthandZeroBits(new JsbnBigInteger('128'), 0)).toBe(0)
    expect(iplist.countRighthandZeroBits(new JsbnBigInteger('128'), 8)).toBe(7)
})

test('test runs', () => {
    process.env['INPUT_LISTS'] = 'test.list'
    const ip = path.join(__dirname, '..', 'lib', 'main.js')
    const options: cp.ExecSyncOptions = {
        env: process.env
    }
    console.log(cp.execSync(`node ${ip}`, options).toString())
})
