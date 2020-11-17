# mm-process-ip-list

This action can be used to process list of IPv4 & IPv6 networks.

The action can be used to:
- aggregate and collapse multiple lists
- drop the entries overlapping a given list of IPv4 & IPv6 networks
- drop the entries overlapping reserved IP networks
- drop the entries where the subnet mask is too *short*

## Inputs

### `list`

*Required*

Name of the list(s) to operate on. This input supports glob patterns (see: [@actions/glob](https://github.com/actions/toolkit/tree/master/packages/glob)).

All the files matching the given glob pattern are aggregated and collapsed before filtering.

### `followSymbolicLinks`

If symbolic link should be followed during processing of glob pattern in `list`.

Default: *true*. Set to `False` to disable symbolic link.

### `initval`

Path to a list of IPv4 & IPv6 networks. Entries from `list` are added to this before processing. You can think of it as the `initval` argument in a `reduce` op.

Default: *none*

### `filter`

Path to a list of IPv4 & IPv6 networks. If an entry from `list` overlaps one of the entries in `filter`, the overlapping part will be dropped and won't show up in `result`.

Default: *none*

### `filterReservedIps`

Drop `entries` from list if they overlap one reserved IP networks (see [Wikipedia](ttps://en.wikipedia.org/wiki/Reserved_IP_addresses) for  a list).

Default: *false*. Set to *True* to enable.

### `minIPv6Mask`

Minimum allowed subnet mask length for IPv6 networks. IPv6 networks from `list` with a subnet mask length lower than this value will be discarded.

Default: 8

### `minIPv4Mask`

Minimum allowed subnet mask length for IPv4 networks. IPv4 networks from `list` with a subnet mask length lower than this value will be discarded.

Default: 8

### `outputDir`

The directory to generate results into.

Default: *./temp*

## Outputs

### `result`

Path of the list with the processing results

### `delta`

Path of the list with entries dropped by filtering operations

## Example usage

### Aggregate & Collapse
```yaml
# Basic usage, all the networks from the files matching *.list pattern
# are aggregated and collapsed.
# 
# Example:
# List (from *.list): 10.0.0.0/24, 10.0.1.0/24, 10.0.2.0/24
# Result: 10.0.0.0/23, 10.0.2.0/24
uses: jtschichold/mm-process-ip-list
with:
  list: *.list
```

### Aggregate & Collapse & Filter
```yaml
# All the networks from the files matching *.list pattern are aggregated,
# collapsed and the subnets overlapping one of the entries in 
# myorgips.filter are dropped (and saved in delta)
#
# Example: 
# List (from *.list): 10.0.0.0, 10.0.0.1, 10.0.1.0/24
# Filter (from myorgs.filter): 10.0.1.128/25
# Result: 10.0.0.0/31, 10.0.1.0/25
uses: jtschichold/mm-process-ip-list
with:
  list: *.list
  filter: myorgips.filter
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)