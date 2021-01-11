// straight from Wikipedia https://en.wikipedia.org/wiki/Reserved_IP_addresses

export const reservedIPv4: string[] = [
    '0.0.0.0/8', // Software Current network (only valid as source address).
    '10.0.0.0/8', // Private network Used for local communications within a private network.
    '100.64.0.0/10', // Private network Shared address space for communications between a service provider and its subscribers when using a carrier-grade NAT.
    '127.0.0.0/8', // Host Used for loopback addresses to the local host.
    '169.254.0.0/16', // Subnet Used for link-local addresses between two hosts on a single link when no IP address is otherwise specified, such as would have normally been retrieved from a DHCP server.
    '172.16.0.0/12', // Private network Used for local communications within a private network.
    '192.0.0.0/24', // Private network IETF Protocol Assignments.
    '192.0.2.0/24', // Documentation Assigned as TEST-NET-1, documentation and examples.
    '192.88.99.0/24', // Internet Reserved. Formerly used for IPv6 to IPv4 relay (included IPv6 address block 2002::/16).
    '192.168.0.0/16', // Private network Used for local communications within a private network.
    '198.18.0.0/15', // Private network Used for benchmark testing of inter-network communications between two separate subnets.
    '198.51.100.0/24', // Documentation Assigned as TEST-NET-2, documentation and examples.
    '203.0.113.0/24', // Documentation Assigned as TEST-NET-3, documentation and examples.
    '224.0.0.0/4', // Internet In use for IP multicast. (Former Class D network).
    '240.0.0.0/4', // Internet Reserved for future use. (Former Class E network).
    '255.255.255.255/32' // Subnet Reserved for the "limited broadcast" destination address.
]

export const reservedIPv6: string[] = [
    '::/128', // Unspecified address.
    '::1/128', // Loopback address to the local host.
    '::ffff:0:0/96', // IPv4 mapped addresses.
    '::ffff:0:0:0/96', // IPv4 translated addresses.
    '64:ff9b::/96', // IPv4/IPv6 translation.
    '100::/64', // Discard prefix.
    '2001::/32', // Teredo tunneling.
    '2001:20::/28', // ORCHIDv2.
    '2001:db8::/32', // Addresses used in documentation and example source code.
    '2002::/16', // The 6to4 addressing scheme (now deprecated).
    'fc00::/7', // Unique local address.
    'fe80::/10', // Link-local address.
    'ff00::/8' // Multicast address.
]
