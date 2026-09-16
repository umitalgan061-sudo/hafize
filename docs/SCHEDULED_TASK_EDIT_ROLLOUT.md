# Schedule Edit Rollout

1. Deploy backend update first so PATCH is accepted before the client begins sending it.
2. Deploy frontend assets after the API is available.
3. Verify GET/POST/PATCH/DELETE schedule smoke flows.
4. Verify worker claim/complete path on an edited schedule.
5. Verify API responses remain uncached.
6. Check error mapping for ownership and non-editable states.
7. Validate mobile and keyboard paths.
8. Keep rollback ready until the first edited schedule completes successfully.
