page_title: Run Grafana-Zabbix from master
page_description: Building instructions for Grafana-Zabbix.

# Run from master

If you want to build a package yourself, or contribute - here is a guide for how to do that.

## Prerequisites

- [NodeJS](https://nodejs.org/) LTS
- [Go](https://golang.org/) version 1.14 or above

## Building

### Install dependencies

```bash
make install
```

### Build plugin (for all platforms)

```bash
make dist
```

### To run frontend and rebuild on file change

```bash
make run-frontend
```

### To run backend and rebuild on file change

```bash
make run-backend
```

### Run tests

```bash
make test
```
