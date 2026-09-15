# Yerel Veri Merkezi — Güvenlik

## Allowlist

Persisted data is controlled through an explicit immutable store registry. A storage key must be present in that registry before the clear path can address it.

## Fail closed

Unknown store IDs produce an error result and do not call `removeItem`. Storage exceptions become unavailable state rather than partial success claims.

## DOM safety

Dynamic labels, descriptions, summaries and previews are assigned through DOM text properties. User-controlled content is not parsed as HTML.

## Bounded reads

The inspector caps a single raw storage read at 1.5 MB. Large values are marked truncated and their contents are not parsed into structured counts.

## Bounded manifest

The diagnostic manifest is capped at 250 KB. It contains only metadata and a short list of unmanaged key names. It is not a content backup.

## External effects

No network, credential, cookie, account, shell, process, WebSocket or telemetry surface exists in the module.

## Destructive actions

Clear operations are exposed as explicit UI actions. The UI requests confirmation before a deletion and performs no deletion while the confirmation is rejected.

## Same-origin assumption

The module uses the current page's browser storage object. It does not attempt cross-origin access or manipulate another origin's data.

## Lifecycle

Event listeners are registered through a tracked helper and removed by `destroy`. Storage listeners refresh state only for the known allowlist or a full-clear storage event.

## PWA

Static files may be cached, but application API requests remain network-only under the existing service-worker policy.

## Threat model

An attacker who can write arbitrary localStorage values can cause malformed or oversized metadata to be displayed as bounded state. They cannot use those values as executable DOM markup through this surface.

## Review rule

Any future storage key added to the product should be evaluated for sensitivity, retention, clear semantics and user-facing disclosure before adding it to the registry.
