---
id: workaround-known-folder-api
type: Workaround
label: "resolve known folders through the registration, not the environment"
---

## Definition

Query SHGetKnownFolderPath with a null token and KF_FLAG_DONT_VERIFY so the registration answers for the current user whether or not the directory exists, check the HRESULT, free the buffer, and treat an empty result as a hard failure at the boundary.
