# Prompt Library Privacy Contract

Trust workflows are device-local. Import preview reads a user-selected file in memory and does not upload it. Diagnostics reads local storage and does not export it. Bulk editing updates local prompt records only.

No analytics identifier, prompt content, profile value or diagnostics result is sent to the server by these modules. The feature does not add cookies, authentication headers or remote telemetry endpoints.

Session previews are bounded and stored under a versioned local key when supported. Prompt export remains a separate explicit user action.

Operational logs must not contain prompt body or profile value. User-facing error messages use generic descriptions rather than raw JSON, filesystem paths or exception payloads.

Deletion semantics remain explicit. Removing a prompt or clearing a profile is a local state change; it does not imply remote deletion because these workflows have no remote replica.

Privacy review should verify that future integrations keep the same boundary: local prompt content must not silently become analytics data.
