---
id: mechanism-ntfs-last-access-disabled
type: Mechanism
label: "NTFS last-access disabled"
---

## Definition

NTFS does not update a file's last-access time on ordinary reads: client SKUs have had NtfsDisableLastAccessUpdate=1 since Vista/7, and Windows 10 1803+/Server 2019+ use a "system managed" mode (fsutil DisableLastAccess = 2/3) that enables updates only on small volumes and coalesces them to once per hour. atime is therefore not evidence that a read happened.

