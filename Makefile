all: install build test lint

# Install dependencies
install:
	# Frontend
	yarn install --pure-lockfile
	# Backend
	go mod vendor
	GO111MODULE=off go get -u golang.org/x/lint/golint

build: build-frontend build-backend
build-frontend:
	yarn dev-build
build-backend:
	env GOOS=linux go build -mod=vendor -o ./dist/zabbix-plugin_linux_amd64 ./pkg
build-debug:
	env GOOS=linux go build -mod=vendor -gcflags=all="-N -l" -o ./dist/zabbix-plugin_linux_amd64 ./pkg

# Build for specific platform
build-backend-windows: extension = .exe
build-backend-%:
	$(eval filename = zabbix-plugin_$*_amd64$(extension))
	env GOOS=$* GOARCH=amd64 go build -mod=vendor -o ./dist/$(filename) ./pkg

run-frontend:
	yarn install --pure-lockfile
	yarn dev

run-backend:
	# Rebuilds plugin on changes and kill running instance which forces grafana to restart plugin
	# See .bra.toml for bra configuration details
	bra run

# Build plugin for all platforms (ready for distribution)
dist: dist-frontend dist-backend
dist-frontend:
	yarn build

dist-backend: dist-backend-linux dist-backend-darwin dist-backend-windows dist-arm
dist-backend-windows: extension = .exe
dist-backend-%:
	$(eval filename = zabbix-plugin_$*_amd64$(extension))
	env GOOS=$* GOARCH=amd64 go build -ldflags="-s -w" -mod=vendor -o ./dist/$(filename) ./pkg

# ARM
dist-arm: dist-arm-linux-arm-v6 dist-arm-linux-arm64
dist-arm-linux-arm-v6:
	env GOOS=linux GOARCH=arm GOARM=6 go build -ldflags="-s -w" -mod=vendor -o ./dist/zabbix-plugin_linux_arm ./pkg
dist-arm-linux-arm-v7:
	env GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s -w" -mod=vendor -o ./dist/zabbix-plugin_linux_arm ./pkg
dist-arm-linux-arm64:
	env GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -mod=vendor -o ./dist/zabbix-plugin_linux_arm64 ./pkg

.PHONY: test
test: test-frontend test-backend
test-frontend:
	yarn test
test-backend:
	go test -mod=vendor ./pkg/...
test-ci:
	yarn ci-test
	mkdir -p tmp/coverage/golang/
	go test -race -coverprofile=tmp/coverage/golang/coverage.txt -covermode=atomic -mod=vendor ./pkg/...

.PHONY: clean
clean:
	-rm -r ./dist/

.PHONY: lint
lint:
	yarn lint
	golint -min_confidence=1.1 -set_exit_status pkg/...
