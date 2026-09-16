# Schedule Edit Operations Checklist

## Deploy öncesi
- Backend PATCH route present.
- Store update mutation present.
- Persistence update queue present.
- Owner guard present.
- Credential guard present.
- API cache boundary present.

## Deploy sonrası
- Create task.
- Edit task.
- Postpone task.
- Repeat-plan task.
- Bulk postpone.
- Bulk cancel.
- Wait for worker claim.
- Verify completed state.

## Incident
- Check normalized error code.
- Check traceId.
- Confirm task body is not logged.
- Inspect persistence save health.
- Revert PR if needed.
