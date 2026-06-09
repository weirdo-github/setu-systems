.PHONY: verify test test-unit test-integration apply-fix

# Run unit tests (no server needed)
test-unit:
	node --test tests/discountPct.test.js

# Run integration tests (requires running server + FIN_COOKIE env var)
test-integration:
	node --test tests/discountPctApi.test.js

# Apply the fix to server/stateStore.js
apply-fix:
	node apply-fix.js

# Run all verifiable tests
test: test-unit

# Verify target: run unit tests
verify: test-unit
	@echo ""
	@echo "✅ All unit tests passed. discountPct is properly bounded to [0, 100]."
	@echo ""
	@echo "To apply the fix to server/stateStore.js, run:"
	@echo "  make apply-fix"
	@echo ""
	@echo "To run integration tests (requires running server):"
	@echo "  FIN_COOKIE='your_cookie' make test-integration"
