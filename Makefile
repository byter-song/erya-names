ESA_ROUTINE ?= erya-names
ESA_SKILL_DIR ?= $(HOME)/.trae/skills/alibabacloud-esa-pages-deploy

.PHONY: install dev preview build typecheck lint format format-check test test-unit test-e2e data-audit security accessibility performance preflight release-prepare release-verify release-check publish publish-esa check-esa-publisher clean

install:
	npm install

dev:
	npm run dev -- --host 127.0.0.1

preview:
	npm run preview -- --host 127.0.0.1

build:
	npm run build

typecheck:
	npm run typecheck

lint:
	npm run lint

format:
	npm run format

format-check:
	npm run format:check

test:
	npm test -- --run

test-unit:
	npm test -- --run

test-e2e:
	npm run test:e2e

data-audit:
	npm run data:audit

security:
	npm run quality:security

accessibility:
	npm run test:accessibility

performance:
	npm run quality:performance

preflight:
	npm run preflight

release-prepare:
	npm run release:prepare

release-verify:
	npm run release:verify

release-check:
	npm run release:check

# Publishes the current static artifact to the existing ESA Functions & Pages routine.
# Credentials stay in the local Alibaba Cloud CLI profile; do not put them in this repository.
check-esa-publisher:
	@test -f "$(ESA_SKILL_DIR)/scripts/deploy-folder.mjs" || (echo "ESA publisher is unavailable. Install alibabacloud-esa-pages-deploy first, or set ESA_SKILL_DIR to its location." >&2; exit 1)
	@test -d "$(ESA_SKILL_DIR)/node_modules" || (echo "ESA publisher dependencies are missing. Install the dependencies required by alibabacloud-esa-pages-deploy." >&2; exit 1)

publish-esa: release-prepare check-esa-publisher
	@test -f dist/index.html || (echo "Missing dist/index.html after build; refusing to publish." >&2; exit 1)
	node "$(ESA_SKILL_DIR)/scripts/deploy-folder.mjs" "$(ESA_ROUTINE)" "$(CURDIR)/dist"

publish: publish-esa

clean:
	rm -rf dist coverage test-results playwright-report .vite
