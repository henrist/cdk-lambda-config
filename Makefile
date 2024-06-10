.PHONY: all build webapp infrastructure app
all: build

build:
	# --ignore-scripts to ignore husky triggers for explicit build
	npm ci --ignore-scripts
	npm run lint
	npm run build
	npm run test
