.PHONY: apply verify test test-unit test-integration clean

# Apply the fix to server/stateStore.js
apply:
	node fix-discount-validation.js

# Run all verification
verify: test-unit
	@echo ""
	@echo "✅ All unit tests passed."
	@echo "To run integration tests (requires running server + auth cookie):"
	@echo "  FIN_COOKIE='your_cookie' make test-integration"

# Run unit tests for the validation module
test-unit:
	node --test tests/discount-pct-validation.test.js

# Run integration tests (requires server at localhost:4173 and FIN_COOKIE env var)
test-integration:
	node --test tests/invoice-api-integration.test.js

# Run all tests
test: test-unit
	@echo "Unit tests complete."

# Show the patch that would be applied (dry run)
dry-run:
	@echo "Checking if patch can be applied..."
	@node -e "const fs=require('fs');const p=require('path').join('server','stateStore.js');if(!fs.existsSync(p)){console.log('stateStore.js not found');process.exit(1);}const c=fs.readFileSync(p,'utf8');if(c.includes('discountPct must be between 0 and 100')){console.log('Already patched');}else if(/const discountPct\\s*=\\s*Number/.test(c)){console.log('Pattern found - patch can be applied');}else{console.log('Pattern NOT found - manual patch needed');}"
