---
id: workaround-reject-device-names
type: Workaround
label: "reject the reserved device stems at the boundary"
---

## Definition

Match generated and extracted filenames against the closed reserved set on the stem rather than the full name, since an extension does not lift the reservation and an existence check afterwards may be answering for the device.
