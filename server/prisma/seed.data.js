// Realistic corporate-IT seed content for the Help Desk Ticket Tracker.
// Kept in its own file so seed.js stays focused on orchestration.

export const DEPARTMENTS = [
  'Finance',
  'Human Resources',
  'Sales',
  'Field Operations',
  'Engineering',
  'Legal',
  'Executive',
  'Customer Support',
  'Marketing',
  'Supply Chain',
];

export const TECHNICIANS = [
  { name: 'Priya Nair', email: 'priya.nair@helpdesk.local', isOnCall: true },
  { name: 'Marcus Cole', email: 'marcus.cole@helpdesk.local' },
  { name: 'Dana Whitfield', email: 'dana.whitfield@helpdesk.local' },
  { name: 'Sven Johansson', email: 'sven.johansson@helpdesk.local' },
  { name: 'Aisha Rahman', email: 'aisha.rahman@helpdesk.local' },
];

export const END_USERS = [
  { name: 'Robert Tran', email: 'robert.tran@corp.local', department: 'Finance' },
  { name: 'Emily Carter', email: 'emily.carter@corp.local', department: 'Human Resources' },
  { name: 'Jamal Woods', email: 'jamal.woods@corp.local', department: 'Sales' },
  { name: 'Grace Liu', email: 'grace.liu@corp.local', department: 'Engineering' },
  { name: 'Diego Martinez', email: 'diego.martinez@corp.local', department: 'Field Operations' },
  { name: 'Hannah Bergström', email: 'hannah.bergstrom@corp.local', department: 'Legal' },
  { name: 'Tom Okafor', email: 'tom.okafor@corp.local', department: 'Executive' },
  { name: 'Lena Petrova', email: 'lena.petrova@corp.local', department: 'Customer Support' },
  { name: 'Owen Fitzgerald', email: 'owen.fitzgerald@corp.local', department: 'Marketing' },
  { name: 'Sara Haddad', email: 'sara.haddad@corp.local', department: 'Supply Chain' },
  { name: 'Victor Nguyen', email: 'victor.nguyen@corp.local', department: 'Field Operations' },
  { name: 'Chloe Bennett', email: 'chloe.bennett@corp.local', department: 'Sales' },
  { name: 'Ibrahim Musa', email: 'ibrahim.musa@corp.local', department: 'Engineering' },
  { name: 'Natalie Foster', email: 'natalie.foster@corp.local', department: 'Finance' },
  { name: 'Kevin Zhao', email: 'kevin.zhao@corp.local', department: 'Customer Support' },
];

export const TICKET_TEMPLATES = [
  {
    name: 'Password Reset',
    category: 'Active Directory',
    defaultImpact: 'SINGLE_USER',
    defaultUrgency: 'WORK_DEGRADED',
    bodyTemplate:
      'User is unable to sign in and has requested a password reset.\n\nUsername: \nLast successful login: \nMFA enrolled (Y/N): \nVerified identity via (callback / manager / badge): ',
    checklist: [
      'Verify caller identity (callback to listed number or manager confirmation)',
      'Confirm account is not disabled or expired in AD',
      'Reset password and set "change at next logon"',
      'Communicate temporary password over a second channel',
      'Confirm successful login with the user',
    ],
  },
  {
    name: 'Printer Offline',
    category: 'Printing',
    defaultImpact: 'DEPARTMENT',
    defaultUrgency: 'WORK_DEGRADED',
    bodyTemplate:
      'Printer is showing offline / jobs are stuck in the queue.\n\nPrinter name/asset tag: \nFloor / location: \nError on panel: \nNumber of users affected: ',
    checklist: [
      'Ping the printer / check it is powered and on the network',
      'Clear and restart the print spooler',
      'Check for paper/toner/firmware alert on the panel',
      'Send a test page from the print server',
      'Confirm with the reporting user that printing works',
    ],
  },
  {
    name: 'VPN Failure',
    category: 'VPN / Remote Access',
    defaultImpact: 'SINGLE_USER',
    defaultUrgency: 'WORK_DEGRADED',
    bodyTemplate:
      'User cannot establish or maintain a VPN connection.\n\nClient version: \nError code/message: \nHome ISP / country: \nWorks on corporate Wi-Fi (Y/N): ',
    checklist: [
      'Confirm the account is active and not locked',
      'Check VPN client version against the supported baseline',
      'Review VPN concentrator logs for the auth/session attempt',
      'Test from a known-good network or device',
      'Have the user reconnect and confirm stable access for 10 minutes',
    ],
  },
  {
    name: 'New Hire Onboarding',
    category: 'Accounts / Onboarding',
    defaultImpact: 'SINGLE_USER',
    defaultUrgency: 'WORKAROUND_AVAILABLE',
    bodyTemplate:
      'Provision accounts and equipment for a new starter.\n\nFull name: \nStart date: \nDepartment / manager: \nRole (for group membership): \nEquipment profile (standard laptop / field / exec): ',
    checklist: [
      'Create AD account and assign to department OU',
      'Add to role-based security and distribution groups',
      'Provision mailbox and licence',
      'Image and enrol laptop in MDM',
      'Schedule day-one orientation and handover',
    ],
  },
  {
    name: 'Outlook / Email Issue',
    category: 'Email',
    defaultImpact: 'SINGLE_USER',
    defaultUrgency: 'WORK_DEGRADED',
    bodyTemplate:
      'User is reporting an email/Outlook problem.\n\nClient (desktop / web / mobile): \nOS version: \nExact error text: \nStarted after (update / migration / n/a): ',
    checklist: [
      'Reproduce the issue in Outlook on the web to isolate client vs service',
      'Check mailbox size and archive policy',
      'Recreate the Outlook profile if desktop-only',
      'Verify no service advisory is active',
      'Confirm send/receive with the user',
    ],
  },
];

export const SOP_TEMPLATES = [
  {
    category: 'Active Directory',
    name: 'AD account lockout / access',
    items: [
      'Verify caller identity via callback or manager confirmation',
      'Check lockout source in the security event log / lockout tool',
      'Confirm no malware or stale cached credentials on the endpoint',
      'Unlock the account and reset the password if required',
      'Confirm successful login and document the lockout source',
    ],
  },
  {
    category: 'VPN / Remote Access',
    name: 'VPN connectivity triage',
    items: [
      'Confirm the account is enabled and MFA is functioning',
      'Check client version against the supported baseline',
      'Review concentrator logs for the session attempt',
      'Test from a second network to isolate ISP/firewall issues',
      'Confirm a stable tunnel for 10 minutes with the user',
    ],
  },
  {
    category: 'Printing',
    name: 'Network printer offline',
    items: [
      'Verify power and network link on the device',
      'Restart the print spooler on the print server',
      'Clear stuck jobs from the queue',
      'Check for firmware / consumable alerts on the panel',
      'Send a test page and confirm with the user',
    ],
  },
  {
    category: 'Hardware',
    name: 'Endpoint hardware fault',
    items: [
      'Capture the asset tag, serial and warranty status',
      'Run vendor diagnostics and record the result codes',
      'Back up local user data if the device still boots',
      'Raise a warranty claim or swap from the loaner pool',
      'Re-enrol the replacement in MDM and hand over',
    ],
  },
  {
    category: 'Email',
    name: 'Mail client / mailbox issue',
    items: [
      'Isolate client vs service using Outlook on the web',
      'Check mailbox quota and retention policy',
      'Rebuild the local profile / OST if desktop-only',
      'Check for a current service advisory',
      'Confirm send and receive with the user',
    ],
  },
];

export const SERVICE_CATALOG = [
  {
    name: 'New Laptop',
    description: 'Request a standard-image corporate laptop for a new or existing employee.',
    category: 'Hardware',
    approvalRequired: true,
    fulfillmentSlaDays: 5,
  },
  {
    name: 'Software Install',
    description: 'Request installation of licensed software from the approved catalog.',
    category: 'Software',
    approvalRequired: true,
    fulfillmentSlaDays: 2,
  },
  {
    name: 'VPN Access',
    description: 'Request remote-access VPN entitlement for an existing account.',
    category: 'Access',
    approvalRequired: true,
    fulfillmentSlaDays: 1,
  },
  {
    name: 'Shared Mailbox',
    description: 'Request creation of a shared mailbox and delegate access for a team.',
    category: 'Email',
    approvalRequired: true,
    fulfillmentSlaDays: 2,
  },
  {
    name: 'Monitor / Docking Station',
    description: 'Request an additional monitor or a replacement docking station.',
    category: 'Hardware',
    approvalRequired: false,
    fulfillmentSlaDays: 3,
  },
  {
    name: 'Mobile Device (MDM enrolled)',
    description: 'Request a corporate iOS or Android device, enrolled in mobile device management.',
    category: 'Mobile',
    approvalRequired: true,
    fulfillmentSlaDays: 7,
  },
];

export const KB_ARTICLES = [
  {
    title: 'Resolving "The trust relationship between this workstation and the primary domain failed"',
    category: 'Active Directory',
    keywords: ['trust', 'domain', 'workstation', 'secure channel', 'rejoin'],
    body:
      'This error means the machine account password is out of sync with the domain.\n\n' +
      '1. Log in with a local administrator account.\n' +
      '2. Open PowerShell as admin and run: Test-ComputerSecureChannel -Verbose\n' +
      '3. If it returns False, repair without rejoining: ' +
      'Reset-ComputerMachinePassword -Server <DC-FQDN> -Credential <DOMAIN\\admin>\n' +
      '4. Reboot and confirm domain login works.\n\n' +
      'Prevention: ensure machines that are offline for long periods (loaners, spares) are ' +
      'powered on and connected at least once every 30 days.',
  },
  {
    title: 'VPN drops every few minutes from home networks after the June firewall change',
    category: 'VPN / Remote Access',
    keywords: ['vpn', 'firewall', 'disconnect', 'mtu', 'calgary', 'keepalive'],
    body:
      'Symptom: tunnel establishes, then drops after 2–5 minutes, most often on residential ISPs.\n\n' +
      'Root cause: the June firewall change enabled stricter fragmentation handling; some home ' +
      'routers advertise a lower MTU.\n\n' +
      'Workaround for the user:\n' +
      '- In the VPN client, set MTU to 1300.\n' +
      '- Disable "UDP first" and force TCP/443 fallback.\n\n' +
      'Permanent fix: firewall team to tune the DF-bit / MSS clamp on the remote-access policy ' +
      '(tracked under the linked Problem record).',
  },
  {
    title: 'Outlook for Mac fails to render the shared calendar after upgrading to macOS Sequoia',
    category: 'Email',
    keywords: ['outlook', 'macos', 'sequoia', 'shared calendar', 'new outlook'],
    body:
      'Affected: "New Outlook" for Mac on macOS Sequoia. Shared calendars appear blank or spin.\n\n' +
      'Steps:\n' +
      '1. Outlook > Settings > toggle OFF "New Outlook" to fall back to Legacy.\n' +
      '2. Remove and re-add the shared calendar under Open Shared Calendar.\n' +
      '3. If staying on New Outlook, ensure build is 16.8x or newer where the fix shipped.\n\n' +
      'Escalate to the messaging team if the mailbox is >45 GB — indexing latency causes the same symptom.',
  },
  {
    title: 'Standard steps for an Active Directory account locked out after invalid login attempts',
    category: 'Active Directory',
    keywords: ['account', 'lockout', 'invalid login', 'attempts', 'unlock'],
    body:
      'When a user reports repeated lockouts:\n\n' +
      '1. Verify identity (callback or manager).\n' +
      '2. Use the lockout tool / event ID 4740 to find the source host.\n' +
      '3. Common causes: a phone with a stale Exchange password, a mapped drive with old creds, ' +
      'a scheduled task running as the user, RDP sessions on another machine.\n' +
      '4. Clear the offending credential, unlock the account, reset if needed.\n' +
      '5. Document the source so repeat lockouts can be spotted quickly.',
  },
  {
    title: 'Printer fleet: applying quarterly firmware and print-driver updates safely',
    category: 'Printing',
    keywords: ['printer', 'firmware', 'driver', 'fleet', 'update', 'rollback'],
    body:
      'Cadence: quarterly, rolled out floor by floor during a change window.\n\n' +
      '1. Snapshot current firmware/driver versions from the fleet dashboard.\n' +
      '2. Pilot on one low-traffic device per model; print a 20-page duplex test and scan-to-email.\n' +
      '3. Stage the driver package on the print server; update the shared queue.\n' +
      '4. Roll firmware in batches of 5; wait 30 minutes between batches.\n' +
      '5. Rollback plan: keep the previous firmware image and driver package for 30 days.',
  },
  {
    title: 'Enrolling a new corporate mobile device (iOS / Android) in MDM',
    category: 'Mobile / MDM',
    keywords: ['mdm', 'ios', 'android', 'enrolment', 'mobile', 'compliance'],
    body:
      '1. Confirm the device IMEI/serial is recorded against the asset and the user.\n' +
      '2. iOS: use Automated Device Enrolment; Android: use the enterprise QR / zero-touch.\n' +
      '3. Push the baseline profile: passcode policy, Wi-Fi, mail, per-app VPN, encryption.\n' +
      '4. Verify compliance status shows green in the MDM console.\n' +
      '5. Hand over with a one-pager on reporting a lost device.',
  },
  {
    title: 'Video-conferencing room kit: no camera or microphone detected before a meeting',
    category: 'Telephony / VC',
    keywords: ['video', 'conferencing', 'camera', 'microphone', 'room', 'usb'],
    body:
      'Fast checks for a room that "has a meeting in 10 minutes":\n\n' +
      '1. Power-cycle the room compute unit (not just the display).\n' +
      '2. Reseat the USB host cable to the codec / camera bar.\n' +
      '3. In the room app, re-select the camera and mic under Settings > Peripherals.\n' +
      '4. If still failing, move the meeting to a laptop + the portable kit from the AV cupboard.\n' +
      '5. Raise a hardware ticket against the room asset tag for follow-up.',
  },
  {
    title: 'Freeing space on a full department file share',
    category: 'Storage / File Share',
    keywords: ['file share', 'storage', 'quota', 'full', 'archive'],
    body:
      '1. Run the storage report to find the largest folders and stale data (>2 years untouched).\n' +
      '2. Notify the data owner; move approved cold data to the archive tier.\n' +
      '3. Empty the share\'s recycle bin / previous versions if policy allows.\n' +
      '4. Raise the quota only as a temporary measure with a follow-up cleanup task.\n' +
      '5. Confirm writes succeed and update the capacity tracker.',
  },
];

export const CHANGE_REQUESTS = [
  {
    title: 'Quarterly firmware rollout — 3rd floor printer fleet (HP E77822)',
    description:
      'Apply firmware 5.7.0.3 and the matching universal print driver to the eight 3rd-floor ' +
      'MFPs. Rolled out in two batches during the Saturday change window.',
    riskLevel: 'MEDIUM',
    rollbackPlan:
      'Previous firmware 5.6.5.1 image and driver package retained on the print server. ' +
      'If scan-to-email or duplex fails post-update, revert firmware per vendor KB and roll back ' +
      'the shared queue driver. Est. rollback time 20 min per device.',
    status: 'APPROVED',
  },
  {
    title: 'Remote-access policy MSS clamp to stop home-network VPN drops',
    description:
      'Add TCP MSS clamping (1240) on the remote-access firewall policy to resolve the recurring ' +
      'VPN disconnects from residential ISPs introduced by the June change.',
    riskLevel: 'HIGH',
    rollbackPlan:
      'Single policy line change. Rollback is removing the clamp statement and committing; ' +
      'sessions re-establish within the 60s keepalive. Change is reversible in under 5 minutes.',
    status: 'PENDING_APPROVAL',
  },
  {
    title: 'Decommission legacy file server FS-04 after data migration',
    description:
      'FS-04 shares have been migrated to the new NAS. Remove DNS aliases, unmount shares, ' +
      'power down and retain for 30 days before disposal.',
    riskLevel: 'LOW',
    rollbackPlan:
      'Server retained powered-off for 30 days. If a missed share is reported, power on, ' +
      're-add the DNS alias and re-share the folder read-only while migration is completed.',
    status: 'SCHEDULED',
  },
];
