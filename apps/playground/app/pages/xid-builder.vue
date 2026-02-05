<script setup lang="ts">
import { XIDDocument, XIDPrivateKeyOptions, XIDGeneratorOptions, Key, Delegate, Service, Privilege } from '@bcts/xid'
import type { Envelope, TreeFormatOptions } from '@bcts/envelope'
import { PrivateKeyBase } from '@bcts/components'
import encodeQR from '@paulmillr/qr'

useHead({
  title: 'XID Builder',
  meta: [
    { name: 'description', content: 'Create and inspect XID Documents with identity display and envelope output' }
  ]
})

const toast = useToast()

// Core document state - shallowRef because XIDDocument has private fields that break deep reactivity
const xidDocument = shallowRef<XIDDocument | null>(null)

// Identity display refs
const xidHex = ref('')
const xidUrString = ref('')
const xidBytewords = ref('')
const xidBytemojis = ref('')

// Inception key display
const inceptionKeyReference = ref('')
const inceptionKeyPermissions = ref<string[]>([])
const inceptionKeyIsInception = ref(false)

// Output refs
const treeOutput = ref('')
const hexOutput = ref('')
const notationOutput = ref('')
const diagnosticOutput = ref('')
const digestOutput = ref('')
const envelopeUrOutput = ref('')
const envelopeOutputMode = ref<'notation' | 'hex' | 'diag'>('notation')
const error = ref<string | null>(null)

// QR state
const showQRModal = ref(false)
const qrCodeDataUrl = ref('')
const qrCodeError = ref<string | null>(null)

// Key management state
const docVersion = ref(0)
const keySectionCollapsed = ref(false)

// Add key modal
const showAddKeyModal = ref(false)
const newKeyScheme = ref<'Ed25519' | 'Schnorr' | 'ECDSA'>('Ed25519')
const newKeyNickname = ref('')
const newKeyAllowPrivileges = ref(new Set<string>(['All']))
const newKeyDenyPrivileges = ref(new Set<string>())

// Inline nickname editing
const editingNicknameKeyRef = ref<string | null>(null)
const editingNicknameValue = ref('')

// Inline permission editing
const editingPermsKeyRef = ref<string | null>(null)
const editingPermsAllow = ref(new Set<string>())
const editingPermsDeny = ref(new Set<string>())

// Endpoint editing
const addingEndpointKeyRef = ref<string | null>(null)
const newEndpointValue = ref('')

// Remove key confirmation
const showRemoveKeyConfirm = ref(false)
const removeKeyTarget = shallowRef<Key | null>(null)
const removeKeyError = ref<string | null>(null)

// Delegate management state
const delegateSectionCollapsed = ref(false)
const showAddDelegateModal = ref(false)
const newDelegateAllowPrivileges = ref(new Set<string>(['All']))
const newDelegateDenyPrivileges = ref(new Set<string>())

// Inline delegate permission editing
const editingDelegatePermsRef = ref<string | null>(null)
const editingDelegatePermsAllow = ref(new Set<string>())
const editingDelegatePermsDeny = ref(new Set<string>())

// Remove delegate confirmation
const showRemoveDelegateConfirm = ref(false)
const removeDelegateTarget = shallowRef<Delegate | null>(null)
const removeDelegateError = ref<string | null>(null)

// Service management state
const serviceSectionCollapsed = ref(false)
const showServiceModal = ref(false)
const serviceModalMode = ref<'add' | 'edit'>('add')
const serviceFormUri = ref('')
const serviceFormName = ref('')
const serviceFormCapability = ref('')
const serviceFormKeyRefs = ref(new Set<string>())
const serviceFormDelegateRefs = ref(new Set<string>())
const serviceFormAllowPrivileges = ref(new Set<string>())
const serviceFormDenyPrivileges = ref(new Set<string>())
const serviceFormError = ref<string | null>(null)

// Remove service confirmation
const showRemoveServiceConfirm = ref(false)
const removeServiceTargetUri = ref<string | null>(null)

// All privilege values for rendering
const ALL_PRIVILEGES = Object.values(Privilege)

// Reactive key list
const keyList = computed(() => {
  void docVersion.value // dependency trigger
  if (!xidDocument.value) return [] as Key[]
  return xidDocument.value.keys()
})

// Reactive delegate list
const delegateList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as Delegate[]
  return xidDocument.value.delegates()
})

// Reactive service list
const serviceList = computed(() => {
  void docVersion.value
  if (!xidDocument.value) return [] as Service[]
  return xidDocument.value.services()
})

// ============================================
// Document Creation
// ============================================

function createNewXID() {
  try {
    error.value = null
    const doc = XIDDocument.new()
    xidDocument.value = doc
    updateIdentityDisplay()
    updateOutput()
    toast.add({ title: 'XID Document created', color: 'success', icon: 'i-heroicons-check-circle' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to create XID document'
  }
}

// ============================================
// Display Updates
// ============================================

function updateIdentityDisplay() {
  const doc = xidDocument.value
  if (!doc) {
    xidHex.value = ''
    xidUrString.value = ''
    xidBytewords.value = ''
    xidBytemojis.value = ''
    inceptionKeyReference.value = ''
    inceptionKeyPermissions.value = []
    inceptionKeyIsInception.value = false
    return
  }

  const xid = doc.xid()
  xidHex.value = xid.toHex()
  xidUrString.value = xid.urString()
  xidBytewords.value = xid.bytewordsIdentifier(true)
  xidBytemojis.value = xid.bytemojisIdentifier(true)

  // Inception key info
  const inceptionKey = doc.inceptionKey()
  if (inceptionKey) {
    inceptionKeyReference.value = inceptionKey.reference().toHex()
    inceptionKeyIsInception.value = true
    const perms = inceptionKey.permissions()
    inceptionKeyPermissions.value = Array.from(perms.allow).map(p => p.toString())
  }
}

function updateOutput() {
  const doc = xidDocument.value
  if (!doc) {
    treeOutput.value = ''
    hexOutput.value = ''
    notationOutput.value = ''
    diagnosticOutput.value = ''
    digestOutput.value = ''
    envelopeUrOutput.value = ''
    error.value = null
    return
  }

  try {
    const envelope: Envelope = doc.toEnvelope(
      XIDPrivateKeyOptions.Omit,
      XIDGeneratorOptions.Omit,
      { type: 'none' }
    )

    const treeOpts: TreeFormatOptions = {}
    treeOutput.value = envelope.treeFormat(treeOpts)
    notationOutput.value = envelope.format()
    diagnosticOutput.value = envelope.diagnostic()

    const bytes = envelope.cborBytes()
    hexOutput.value = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
    digestOutput.value = envelope.digest().hex()
    envelopeUrOutput.value = envelope.urString()
    error.value = null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unknown error building envelope'
    treeOutput.value = ''
    hexOutput.value = ''
    notationOutput.value = ''
    diagnosticOutput.value = ''
    digestOutput.value = ''
    envelopeUrOutput.value = ''
  }
}

// ============================================
// Actions
// ============================================

async function copyToClipboard(text: string, label: string) {
  await navigator.clipboard.writeText(text)
  toast.add({ title: `${label} copied`, color: 'success', icon: 'i-heroicons-clipboard-document-check' })
}

function clearDocument() {
  xidDocument.value = null
  updateIdentityDisplay()
  updateOutput()
  toast.add({ title: 'Document cleared', color: 'neutral', icon: 'i-heroicons-trash' })
}

// ============================================
// Key Management
// ============================================

function refreshDocument() {
  docVersion.value++
  updateIdentityDisplay()
  updateOutput()
}

function getKeyAlgorithm(key: Key): string {
  try {
    return key.publicKeys().signingPublicKey().keyType()
  } catch {
    return 'Unknown'
  }
}

function isKeyInception(key: Key): boolean {
  const doc = xidDocument.value
  if (!doc) return false
  const inception = doc.inceptionKey()
  if (!inception) return false
  return inception.reference().toHex() === key.reference().toHex()
}

function getKeyRefHex(key: Key): string {
  return key.reference().toHex()
}

function openAddKeyModal() {
  newKeyScheme.value = 'Ed25519'
  newKeyNickname.value = ''
  newKeyAllowPrivileges.value = new Set(['All'])
  newKeyDenyPrivileges.value = new Set()
  showAddKeyModal.value = true
}

function togglePrivilege(set: Set<string>, priv: string) {
  if (set.has(priv)) {
    set.delete(priv)
  } else {
    set.add(priv)
  }
}

function addNewKey() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    const pkb = PrivateKeyBase.new()
    let key: Key

    switch (newKeyScheme.value) {
      case 'Ed25519':
        key = Key.newWithPrivateKeys(pkb.ed25519PrivateKeys(), pkb.ed25519PublicKeys())
        break
      case 'Schnorr':
        key = Key.newWithPrivateKeys(pkb.schnorrPrivateKeys(), pkb.schnorrPublicKeys())
        break
      case 'ECDSA':
        key = Key.newWithPrivateKeys(pkb.ecdsaPrivateKeys(), pkb.ecdsaPublicKeys())
        break
    }

    for (const p of newKeyAllowPrivileges.value) {
      key.addPermission(p as Privilege)
    }
    const perms = key.permissionsMut()
    for (const p of newKeyDenyPrivileges.value) {
      perms.addDeny(p as Privilege)
    }

    if (newKeyNickname.value.trim()) {
      key.setNickname(newKeyNickname.value.trim())
    }

    doc.addKey(key)
    showAddKeyModal.value = false
    refreshDocument()
    toast.add({ title: 'Key added', color: 'success', icon: 'i-heroicons-key' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to add key', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function confirmRemoveKey(key: Key) {
  const doc = xidDocument.value
  if (!doc) return

  if (isKeyInception(key)) {
    toast.add({ title: 'Cannot remove the inception key', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
    return
  }

  removeKeyError.value = doc.servicesReferenceKey(key.publicKeys())
    ? 'This key is referenced by a service. Remove the service reference first.'
    : null

  removeKeyTarget.value = key
  showRemoveKeyConfirm.value = true
}

function executeRemoveKey() {
  const doc = xidDocument.value
  const key = removeKeyTarget.value
  if (!doc || !key) return

  try {
    doc.removeKey(key.publicKeys())
    showRemoveKeyConfirm.value = false
    removeKeyTarget.value = null
    refreshDocument()
    toast.add({ title: 'Key removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove key', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function startEditNickname(key: Key) {
  editingNicknameKeyRef.value = getKeyRefHex(key)
  editingNicknameValue.value = key.nickname()
}

function saveNickname(key: Key) {
  const doc = xidDocument.value
  if (!doc) return

  try {
    doc.setNameForKey(key.publicKeys(), editingNicknameValue.value.trim())
    editingNicknameKeyRef.value = null
    refreshDocument()
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to update nickname', color: 'error' })
  }
}

function cancelEditNickname() {
  editingNicknameKeyRef.value = null
  editingNicknameValue.value = ''
}

function startEditPermissions(key: Key) {
  editingPermsKeyRef.value = getKeyRefHex(key)
  editingPermsAllow.value = new Set(Array.from(key.permissions().allow).map(String))
  editingPermsDeny.value = new Set(Array.from(key.permissions().deny).map(String))
}

function savePermissions(key: Key) {
  const perms = key.permissionsMut()
  perms.allow.clear()
  perms.deny.clear()
  for (const p of editingPermsAllow.value) {
    perms.addAllow(p as Privilege)
  }
  for (const p of editingPermsDeny.value) {
    perms.addDeny(p as Privilege)
  }
  editingPermsKeyRef.value = null
  refreshDocument()
  toast.add({ title: 'Permissions updated', color: 'success', icon: 'i-heroicons-shield-check' })
}

function cancelEditPermissions() {
  editingPermsKeyRef.value = null
}

function startAddEndpoint(key: Key) {
  addingEndpointKeyRef.value = getKeyRefHex(key)
  newEndpointValue.value = ''
}

function addEndpointToKey(key: Key) {
  const ep = newEndpointValue.value.trim()
  if (!ep) return
  key.addEndpoint(ep)
  newEndpointValue.value = ''
  addingEndpointKeyRef.value = null
  refreshDocument()
  toast.add({ title: 'Endpoint added', color: 'success', icon: 'i-heroicons-link' })
}

function removeEndpointFromKey(key: Key, endpoint: string) {
  key.endpointsMut().delete(endpoint)
  refreshDocument()
  toast.add({ title: 'Endpoint removed', color: 'neutral', icon: 'i-heroicons-trash' })
}

function cancelAddEndpoint() {
  addingEndpointKeyRef.value = null
  newEndpointValue.value = ''
}

// ============================================
// Delegate Management
// ============================================

function getDelegateXidHex(delegate: Delegate): string {
  return delegate.xid().toHex()
}

function openAddDelegateModal() {
  newDelegateAllowPrivileges.value = new Set(['All'])
  newDelegateDenyPrivileges.value = new Set()
  showAddDelegateModal.value = true
}

function addNewDelegate() {
  const doc = xidDocument.value
  if (!doc) return

  try {
    const controllerDoc = XIDDocument.new()
    const delegate = Delegate.new(controllerDoc)

    for (const p of newDelegateAllowPrivileges.value) {
      delegate.permissionsMut().addAllow(p as Privilege)
    }
    for (const p of newDelegateDenyPrivileges.value) {
      delegate.permissionsMut().addDeny(p as Privilege)
    }

    doc.addDelegate(delegate)
    showAddDelegateModal.value = false
    refreshDocument()
    toast.add({ title: 'Delegate added', color: 'success', icon: 'i-heroicons-user-plus' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to add delegate', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function confirmRemoveDelegate(delegate: Delegate) {
  const doc = xidDocument.value
  if (!doc) return

  removeDelegateError.value = doc.servicesReferenceDelegate(delegate.xid())
    ? 'This delegate is referenced by a service. Remove the service reference first.'
    : null

  removeDelegateTarget.value = delegate
  showRemoveDelegateConfirm.value = true
}

function executeRemoveDelegate() {
  const doc = xidDocument.value
  const delegate = removeDelegateTarget.value
  if (!doc || !delegate) return

  try {
    doc.removeDelegate(delegate.xid())
    showRemoveDelegateConfirm.value = false
    removeDelegateTarget.value = null
    refreshDocument()
    toast.add({ title: 'Delegate removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove delegate', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

function startEditDelegatePermissions(delegate: Delegate) {
  editingDelegatePermsRef.value = getDelegateXidHex(delegate)
  editingDelegatePermsAllow.value = new Set(Array.from(delegate.permissions().allow).map(String))
  editingDelegatePermsDeny.value = new Set(Array.from(delegate.permissions().deny).map(String))
}

function saveDelegatePermissions(delegate: Delegate) {
  const perms = delegate.permissionsMut()
  perms.allow.clear()
  perms.deny.clear()
  for (const p of editingDelegatePermsAllow.value) {
    perms.addAllow(p as Privilege)
  }
  for (const p of editingDelegatePermsDeny.value) {
    perms.addDeny(p as Privilege)
  }
  editingDelegatePermsRef.value = null
  refreshDocument()
  toast.add({ title: 'Permissions updated', color: 'success', icon: 'i-heroicons-shield-check' })
}

function cancelEditDelegatePermissions() {
  editingDelegatePermsRef.value = null
}

// ============================================
// Service Management
// ============================================

function getDelegateRefHex(delegate: Delegate): string {
  return delegate.reference().toHex()
}

function getKeyLabelByRef(refHex: string): string {
  const key = keyList.value.find(k => k.reference().toHex() === refHex)
  if (!key) return refHex.substring(0, 8) + '...'
  const nick = key.nickname()
  return nick || `${getKeyAlgorithm(key)} (${refHex.substring(0, 8)}...)`
}

function getDelegateLabelByRef(refHex: string): string {
  const delegate = delegateList.value.find(d => d.reference().toHex() === refHex)
  if (!delegate) return refHex.substring(0, 8) + '...'
  return getDelegateXidHex(delegate).substring(0, 12) + '...'
}

function openAddServiceModal() {
  serviceModalMode.value = 'add'
  serviceFormUri.value = ''
  serviceFormName.value = ''
  serviceFormCapability.value = ''
  serviceFormKeyRefs.value = new Set()
  serviceFormDelegateRefs.value = new Set()
  serviceFormAllowPrivileges.value = new Set()
  serviceFormDenyPrivileges.value = new Set()
  serviceFormError.value = null
  showServiceModal.value = true
}

function openEditServiceModal(service: Service) {
  serviceModalMode.value = 'edit'
  serviceFormUri.value = service.uri()
  serviceFormName.value = service.name()
  serviceFormCapability.value = service.capability()
  serviceFormKeyRefs.value = new Set(service.keyReferences())
  serviceFormDelegateRefs.value = new Set(service.delegateReferences())
  serviceFormAllowPrivileges.value = new Set(Array.from(service.permissions().allow).map(String))
  serviceFormDenyPrivileges.value = new Set(Array.from(service.permissions().deny).map(String))
  serviceFormError.value = null
  showServiceModal.value = true
}

function saveService() {
  const doc = xidDocument.value
  if (!doc) return

  const uri = serviceFormUri.value.trim()
  if (!uri) {
    serviceFormError.value = 'URI is required'
    return
  }

  if (serviceFormKeyRefs.value.size === 0 && serviceFormDelegateRefs.value.size === 0) {
    serviceFormError.value = 'At least one key or delegate reference is required'
    return
  }

  if (serviceFormAllowPrivileges.value.size === 0) {
    serviceFormError.value = 'At least one allowed permission is required'
    return
  }

  try {
    // If editing, remove the old service first
    if (serviceModalMode.value === 'edit') {
      doc.takeService(uri)
    }

    const service = Service.new(uri)

    if (serviceFormName.value.trim()) {
      service.setName(serviceFormName.value.trim())
    }

    if (serviceFormCapability.value.trim()) {
      service.setCapability(serviceFormCapability.value.trim())
    }

    for (const ref of serviceFormKeyRefs.value) {
      service.addKeyReferenceHex(ref)
    }

    for (const ref of serviceFormDelegateRefs.value) {
      service.addDelegateReferenceHex(ref)
    }

    for (const p of serviceFormAllowPrivileges.value) {
      service.permissionsMut().addAllow(p as Privilege)
    }
    for (const p of serviceFormDenyPrivileges.value) {
      service.permissionsMut().addDeny(p as Privilege)
    }

    doc.addService(service)
    showServiceModal.value = false
    refreshDocument()
    toast.add({
      title: serviceModalMode.value === 'add' ? 'Service added' : 'Service updated',
      color: 'success',
      icon: 'i-heroicons-server-stack'
    })
  } catch (e) {
    serviceFormError.value = e instanceof Error ? e.message : 'Failed to save service'
  }
}

function confirmRemoveService(service: Service) {
  removeServiceTargetUri.value = service.uri()
  showRemoveServiceConfirm.value = true
}

function executeRemoveService() {
  const doc = xidDocument.value
  const uri = removeServiceTargetUri.value
  if (!doc || !uri) return

  try {
    doc.removeService(uri)
    showRemoveServiceConfirm.value = false
    removeServiceTargetUri.value = null
    refreshDocument()
    toast.add({ title: 'Service removed', color: 'success', icon: 'i-heroicons-trash' })
  } catch (e) {
    toast.add({ title: e instanceof Error ? e.message : 'Failed to remove service', color: 'error', icon: 'i-heroicons-exclamation-triangle' })
  }
}

// ============================================
// QR Code Generation
// ============================================

function generateQRCode() {
  if (!envelopeUrOutput.value) {
    qrCodeError.value = 'No envelope data to encode'
    return
  }

  qrCodeError.value = null

  try {
    const urData = envelopeUrOutput.value.toUpperCase()

    const qrData = encodeQR(urData, 'raw', {
      ecc: 'low',
      border: 2
    })

    const size = qrData.length
    const scale = 4
    const svgSize = size * scale

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgSize} ${svgSize}" width="300" height="300">
      <rect width="${svgSize}" height="${svgSize}" fill="#ffffff"/>
      ${qrData.map((row: boolean[], y: number) =>
        row.map((cell: boolean, x: number) =>
          cell ? `<rect x="${x * scale}" y="${y * scale}" width="${scale}" height="${scale}" fill="#000000"/>` : ''
        ).join('')
      ).join('')}
    </svg>`

    qrCodeDataUrl.value = `data:image/svg+xml;base64,${btoa(svg)}`
  } catch (e) {
    console.error('QR code generation error:', e)
    qrCodeError.value = e instanceof Error ? e.message : 'Failed to generate QR code'
  }
}

function openQRModal() {
  if (!envelopeUrOutput.value) {
    toast.add({ title: 'Create an XID document first', color: 'warning', icon: 'i-heroicons-exclamation-triangle' })
    return
  }
  showQRModal.value = true
  generateQRCode()
}

async function downloadQRCode() {
  if (!qrCodeDataUrl.value) return

  const link = document.createElement('a')
  link.download = 'xid-qr.svg'
  link.href = qrCodeDataUrl.value
  link.click()
}
</script>

<template>
  <UDashboardPanel id="xid-builder">
    <template #header>
      <UDashboardNavbar title="XID Builder">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UTooltip text="Create new XID Document">
            <UButton
              icon="i-heroicons-plus"
              color="primary"
              variant="soft"
              size="sm"
              @click="createNewXID"
            >
              New
            </UButton>
          </UTooltip>
          <UTooltip text="Show QR Code">
            <UButton
              icon="i-heroicons-qr-code"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!xidDocument"
              @click="openQRModal"
            />
          </UTooltip>
          <UTooltip text="Clear document">
            <UButton
              icon="i-heroicons-trash"
              color="neutral"
              variant="ghost"
              size="sm"
              :disabled="!xidDocument"
              @click="clearDocument"
            />
          </UTooltip>
          <UColorModeButton size="sm" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex h-full">
        <!-- Document Panel -->
        <div class="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Document</h3>
            <div v-if="xidDocument" class="flex items-center gap-2">
              <UBadge color="primary" variant="soft" size="xs">
                <UIcon name="i-heroicons-finger-print" class="w-3 h-3 mr-1" />
                {{ digestOutput.substring(0, 8) }}...
              </UBadge>
            </div>
          </div>

          <div class="flex-1 overflow-auto p-4">
            <!-- Empty State -->
            <div v-if="!xidDocument" class="h-full flex flex-col items-center justify-center">
              <div class="text-center max-w-sm">
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-4 inline-block">
                  <UIcon name="i-heroicons-identification" class="w-8 h-8 text-gray-400" />
                </div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">No XID Document</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Create a new XID Document to get started. A default Ed25519 inception key will be generated automatically.
                </p>
                <UButton
                  icon="i-heroicons-plus"
                  color="primary"
                  @click="createNewXID"
                >
                  Create XID Document
                </UButton>
              </div>
            </div>

            <!-- Document Content -->
            <div v-else class="space-y-4">
              <!-- Identity Section -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Identity</h4>
                <div class="space-y-2">
                  <!-- UR String -->
                  <div class="flex items-center gap-2">
                    <UBadge color="primary" variant="soft" size="xs">UR</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono break-all text-gray-700 dark:text-gray-300">{{ xidUrString }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidUrString, 'XID UR')"
                    />
                  </div>
                  <!-- Hex -->
                  <div class="flex items-center gap-2">
                    <UBadge color="neutral" variant="soft" size="xs">Hex</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono break-all text-gray-600 dark:text-gray-400">{{ xidHex }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidHex, 'XID Hex')"
                    />
                  </div>
                  <!-- Bytewords -->
                  <div class="flex items-center gap-2">
                    <UBadge color="info" variant="soft" size="xs">Words</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono text-gray-700 dark:text-gray-300">{{ xidBytewords }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidBytewords, 'XID Bytewords')"
                    />
                  </div>
                  <!-- Bytemojis -->
                  <div class="flex items-center gap-2">
                    <UBadge color="warning" variant="soft" size="xs">Emoji</UBadge>
                    <code class="flex-1 text-xs bg-gray-100 dark:bg-gray-800/50 p-1.5 rounded font-mono text-gray-700 dark:text-gray-300">{{ xidBytemojis }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(xidBytemojis, 'XID Bytemojis')"
                    />
                  </div>
                </div>
              </div>

              <!-- Inception Key Section -->
              <div>
                <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Inception Key</h4>
                <div class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
                  <div class="flex items-center gap-2">
                    <UBadge v-if="inceptionKeyIsInception" color="success" variant="soft" size="xs">Inception</UBadge>
                    <UBadge color="neutral" variant="soft" size="xs">Ed25519</UBadge>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Reference:</span>
                    <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">{{ inceptionKeyReference }}</code>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(inceptionKeyReference, 'Key reference')"
                    />
                  </div>
                  <div v-if="inceptionKeyPermissions.length > 0" class="flex items-center gap-1 flex-wrap">
                    <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Permissions:</span>
                    <UBadge
                      v-for="perm in inceptionKeyPermissions"
                      :key="perm"
                      color="primary"
                      variant="soft"
                      size="xs"
                    >
                      {{ perm }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <!-- Keys Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="keySectionCollapsed = !keySectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="keySectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Keys</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ keyList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddKeyModal" />
                </div>

                <div v-if="!keySectionCollapsed" class="mt-2 space-y-2">
                  <div
                    v-for="keyItem in keyList"
                    :key="getKeyRefHex(keyItem)"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border"
                    :class="isKeyInception(keyItem) ? 'border-primary-300 dark:border-primary-600' : 'border-gray-200 dark:border-gray-700'"
                  >
                    <!-- Header: badges + actions -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <UBadge v-if="isKeyInception(keyItem)" color="success" variant="soft" size="xs">Inception</UBadge>
                        <UBadge color="neutral" variant="soft" size="xs">{{ getKeyAlgorithm(keyItem) }}</UBadge>
                      </div>
                      <UTooltip v-if="!isKeyInception(keyItem)" text="Remove key">
                        <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="confirmRemoveKey(keyItem)" />
                      </UTooltip>
                    </div>

                    <!-- Nickname -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Name:</span>
                      <template v-if="editingNicknameKeyRef === getKeyRefHex(keyItem)">
                        <input
                          v-model="editingNicknameValue"
                          class="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5 text-gray-700 dark:text-gray-300"
                          @keyup.enter="saveNickname(keyItem)"
                          @keyup.escape="cancelEditNickname"
                        >
                        <UButton icon="i-heroicons-check" size="xs" color="success" variant="ghost" @click="saveNickname(keyItem)" />
                        <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost" @click="cancelEditNickname" />
                      </template>
                      <template v-else>
                        <span class="flex-1 text-xs text-gray-700 dark:text-gray-300">{{ keyItem.nickname() || '(unnamed)' }}</span>
                        <UButton icon="i-heroicons-pencil" size="xs" color="neutral" variant="ghost" @click="startEditNickname(keyItem)" />
                      </template>
                    </div>

                    <!-- Reference -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Ref:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ getKeyRefHex(keyItem) }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(getKeyRefHex(keyItem), 'Key reference')" />
                    </div>

                    <!-- Permissions (display mode) -->
                    <div v-if="editingPermsKeyRef !== getKeyRefHex(keyItem)">
                      <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Allow:</span>
                        <UBadge v-for="perm in Array.from(keyItem.permissions().allow)" :key="'a-' + perm" color="success" variant="soft" size="xs">{{ perm }}</UBadge>
                        <span v-if="keyItem.permissions().allow.size === 0" class="text-xs text-gray-400 italic">none</span>
                      </div>
                      <div v-if="keyItem.permissions().deny.size > 0" class="flex items-center gap-1 flex-wrap mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Deny:</span>
                        <UBadge v-for="perm in Array.from(keyItem.permissions().deny)" :key="'d-' + perm" color="error" variant="soft" size="xs">{{ perm }}</UBadge>
                      </div>
                      <UButton class="mt-1" icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost" label="Edit permissions" @click="startEditPermissions(keyItem)" />
                    </div>

                    <!-- Permissions (editor mode) -->
                    <div v-else class="space-y-2">
                      <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-white dark:bg-gray-900/50 rounded p-2">
                        <div class="font-medium text-gray-500">Privilege</div>
                        <div class="font-medium text-gray-500 text-center">Allow</div>
                        <div class="font-medium text-gray-500 text-center">Deny</div>
                        <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                          <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                          <div class="text-center"><input type="checkbox" :checked="editingPermsAllow.has(priv)" @change="togglePrivilege(editingPermsAllow, priv)"></div>
                          <div class="text-center"><input type="checkbox" :checked="editingPermsDeny.has(priv)" @change="togglePrivilege(editingPermsDeny, priv)"></div>
                        </template>
                      </div>
                      <div class="flex gap-1">
                        <UButton size="xs" color="primary" variant="soft" @click="savePermissions(keyItem)">Save</UButton>
                        <UButton size="xs" color="neutral" variant="ghost" @click="cancelEditPermissions">Cancel</UButton>
                      </div>
                    </div>

                    <!-- Endpoints -->
                    <div>
                      <div v-if="Array.from(keyItem.endpoints()).length > 0" class="space-y-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400">Endpoints:</span>
                        <div v-for="ep in Array.from(keyItem.endpoints())" :key="ep" class="flex items-center gap-1 ml-2">
                          <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ ep }}</code>
                          <UButton icon="i-heroicons-x-mark" size="xs" color="error" variant="ghost" @click="removeEndpointFromKey(keyItem, ep)" />
                        </div>
                      </div>
                      <div v-if="addingEndpointKeyRef === getKeyRefHex(keyItem)" class="flex items-center gap-1 mt-1">
                        <input
                          v-model="newEndpointValue"
                          placeholder="https://..."
                          class="flex-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-1.5 py-0.5"
                          @keyup.enter="addEndpointToKey(keyItem)"
                          @keyup.escape="cancelAddEndpoint"
                        >
                        <UButton icon="i-heroicons-check" size="xs" color="success" variant="ghost" @click="addEndpointToKey(keyItem)" />
                        <UButton icon="i-heroicons-x-mark" size="xs" color="neutral" variant="ghost" @click="cancelAddEndpoint" />
                      </div>
                      <UButton
                        v-else
                        class="mt-1"
                        icon="i-heroicons-link"
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        label="Add endpoint"
                        @click="startAddEndpoint(keyItem)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Delegates Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="delegateSectionCollapsed = !delegateSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="delegateSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Delegates</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ delegateList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddDelegateModal" />
                </div>

                <div v-if="!delegateSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="delegateList.length === 0" class="text-xs text-gray-400 italic pl-5">No delegates</div>
                  <div
                    v-for="delegateItem in delegateList"
                    :key="getDelegateXidHex(delegateItem)"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700"
                  >
                    <!-- Header: badge + remove -->
                    <div class="flex items-center justify-between">
                      <UBadge color="info" variant="soft" size="xs">Delegate</UBadge>
                      <UTooltip text="Remove delegate">
                        <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="confirmRemoveDelegate(delegateItem)" />
                      </UTooltip>
                    </div>

                    <!-- Controller XID -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">XID:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ getDelegateXidHex(delegateItem) }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(getDelegateXidHex(delegateItem), 'Delegate XID')" />
                    </div>

                    <!-- Permissions (display mode) -->
                    <div v-if="editingDelegatePermsRef !== getDelegateXidHex(delegateItem)">
                      <div class="flex items-center gap-1 flex-wrap">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Allow:</span>
                        <UBadge v-for="perm in Array.from(delegateItem.permissions().allow)" :key="'da-' + perm" color="success" variant="soft" size="xs">{{ perm }}</UBadge>
                        <span v-if="delegateItem.permissions().allow.size === 0" class="text-xs text-gray-400 italic">none</span>
                      </div>
                      <div v-if="delegateItem.permissions().deny.size > 0" class="flex items-center gap-1 flex-wrap mt-1">
                        <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Deny:</span>
                        <UBadge v-for="perm in Array.from(delegateItem.permissions().deny)" :key="'dd-' + perm" color="error" variant="soft" size="xs">{{ perm }}</UBadge>
                      </div>
                      <UButton class="mt-1" icon="i-heroicons-pencil-square" size="xs" color="neutral" variant="ghost" label="Edit permissions" @click="startEditDelegatePermissions(delegateItem)" />
                    </div>

                    <!-- Permissions (editor mode) -->
                    <div v-else class="space-y-2">
                      <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-white dark:bg-gray-900/50 rounded p-2">
                        <div class="font-medium text-gray-500">Privilege</div>
                        <div class="font-medium text-gray-500 text-center">Allow</div>
                        <div class="font-medium text-gray-500 text-center">Deny</div>
                        <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                          <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                          <div class="text-center"><input type="checkbox" :checked="editingDelegatePermsAllow.has(priv)" @change="togglePrivilege(editingDelegatePermsAllow, priv)"></div>
                          <div class="text-center"><input type="checkbox" :checked="editingDelegatePermsDeny.has(priv)" @change="togglePrivilege(editingDelegatePermsDeny, priv)"></div>
                        </template>
                      </div>
                      <div class="flex gap-1">
                        <UButton size="xs" color="primary" variant="soft" @click="saveDelegatePermissions(delegateItem)">Save</UButton>
                        <UButton size="xs" color="neutral" variant="ghost" @click="cancelEditDelegatePermissions">Cancel</UButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Services Section (collapsible) -->
              <div>
                <div class="flex items-center justify-between cursor-pointer" @click="serviceSectionCollapsed = !serviceSectionCollapsed">
                  <div class="flex items-center gap-2">
                    <UIcon :name="serviceSectionCollapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-down'" class="w-3.5 h-3.5 text-gray-400" />
                    <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Services</h4>
                    <UBadge color="neutral" variant="soft" size="xs">{{ serviceList.length }}</UBadge>
                  </div>
                  <UButton icon="i-heroicons-plus" size="xs" color="neutral" variant="ghost" @click.stop="openAddServiceModal" />
                </div>

                <div v-if="!serviceSectionCollapsed" class="mt-2 space-y-2">
                  <div v-if="serviceList.length === 0" class="text-xs text-gray-400 italic pl-5">No services</div>
                  <div
                    v-for="serviceItem in serviceList"
                    :key="serviceItem.uri()"
                    class="bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700"
                  >
                    <!-- Header: badges + actions -->
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <UBadge color="primary" variant="soft" size="xs">Service</UBadge>
                        <UBadge v-if="serviceItem.name()" color="info" variant="soft" size="xs">{{ serviceItem.name() }}</UBadge>
                      </div>
                      <div class="flex items-center gap-1">
                        <UTooltip text="Edit service">
                          <UButton icon="i-heroicons-pencil" size="xs" color="neutral" variant="ghost" @click="openEditServiceModal(serviceItem)" />
                        </UTooltip>
                        <UTooltip text="Remove service">
                          <UButton icon="i-heroicons-trash" size="xs" color="error" variant="ghost" @click="confirmRemoveService(serviceItem)" />
                        </UTooltip>
                      </div>
                    </div>

                    <!-- URI -->
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">URI:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ serviceItem.uri() }}</code>
                      <UButton icon="i-heroicons-clipboard-document" size="xs" color="neutral" variant="ghost" @click="copyToClipboard(serviceItem.uri(), 'Service URI')" />
                    </div>

                    <!-- Capability -->
                    <div v-if="serviceItem.capability()" class="flex items-center gap-2">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Capability:</span>
                      <code class="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{{ serviceItem.capability() }}</code>
                    </div>

                    <!-- Key References -->
                    <div v-if="serviceItem.keyReferences().size > 0" class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Keys:</span>
                      <UBadge v-for="ref in Array.from(serviceItem.keyReferences())" :key="'sk-' + ref" color="neutral" variant="soft" size="xs">
                        {{ getKeyLabelByRef(ref) }}
                      </UBadge>
                    </div>

                    <!-- Delegate References -->
                    <div v-if="serviceItem.delegateReferences().size > 0" class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Delegates:</span>
                      <UBadge v-for="ref in Array.from(serviceItem.delegateReferences())" :key="'sdr-' + ref" color="info" variant="soft" size="xs">
                        {{ getDelegateLabelByRef(ref) }}
                      </UBadge>
                    </div>

                    <!-- Permissions -->
                    <div class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Allow:</span>
                      <UBadge v-for="perm in Array.from(serviceItem.permissions().allow)" :key="'sa-' + perm" color="success" variant="soft" size="xs">{{ perm }}</UBadge>
                      <span v-if="serviceItem.permissions().allow.size === 0" class="text-xs text-gray-400 italic">none</span>
                    </div>
                    <div v-if="serviceItem.permissions().deny.size > 0" class="flex items-center gap-1 flex-wrap">
                      <span class="text-xs text-gray-500 dark:text-gray-400 shrink-0">Deny:</span>
                      <UBadge v-for="perm in Array.from(serviceItem.permissions().deny)" :key="'sdp-' + perm" color="error" variant="soft" size="xs">{{ perm }}</UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Envelope UR Section -->
              <div v-if="envelopeUrOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Envelope UR</h4>
                  <div class="flex items-center gap-1">
                    <UButton
                      icon="i-heroicons-qr-code"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="openQRModal"
                    />
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(envelopeUrOutput, 'Envelope UR')"
                    />
                  </div>
                </div>
                <code class="block text-xs bg-gray-100 dark:bg-gray-800/50 p-2 rounded font-mono break-all text-gray-600 dark:text-gray-400 max-h-24 overflow-y-auto">{{ envelopeUrOutput }}</code>
              </div>
            </div>
          </div>
        </div>

        <!-- Output Panel -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-800/50 bg-gray-50 dark:bg-gray-900/50">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
          </div>

          <div class="flex-1 overflow-auto p-4 space-y-4">
            <!-- Error Display -->
            <UAlert
              v-if="error"
              color="error"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              :title="error"
            />

            <!-- Empty State -->
            <div v-if="!xidDocument" class="h-full flex flex-col items-center justify-center">
              <div class="text-center max-w-sm">
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-full p-4 mb-4 inline-block">
                  <UIcon name="i-heroicons-document-text" class="w-8 h-8 text-gray-400" />
                </div>
                <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">No Output</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Create an XID Document to see its envelope output here.
                </p>
              </div>
            </div>

            <template v-else>
              <!-- Digest Display -->
              <div v-if="digestOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Digest</h4>
                  <UButton
                    icon="i-heroicons-clipboard-document"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="copyToClipboard(digestOutput, 'Digest')"
                  />
                </div>
                <div class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-2 text-xs font-mono text-gray-600 dark:text-gray-400 break-all">
                  {{ digestOutput }}
                </div>
              </div>

              <!-- Tree Format Output -->
              <div v-if="treeOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tree Format</h4>
                  <UButton
                    icon="i-heroicons-clipboard-document"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="copyToClipboard(treeOutput, 'Tree format')"
                  />
                </div>
                <pre class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">{{ treeOutput }}</pre>
              </div>

              <!-- Envelope Output (Notation / CBOR Hex / CBOR Diagnostic) -->
              <div v-if="notationOutput || hexOutput || diagnosticOutput">
                <div class="flex items-center justify-between mb-2">
                  <h4 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {{ envelopeOutputMode === 'notation' ? 'Envelope Notation' : envelopeOutputMode === 'hex' ? 'CBOR (Hex)' : 'CBOR Diagnostic' }}
                    <UBadge v-if="envelopeOutputMode === 'hex' && hexOutput" color="neutral" variant="soft" size="xs" class="ml-1">{{ hexOutput.length / 2 }} bytes</UBadge>
                  </h4>
                  <div class="flex items-center gap-1">
                    <select
                      v-model="envelopeOutputMode"
                      class="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5"
                    >
                      <option value="notation">Notation</option>
                      <option value="hex">CBOR Hex</option>
                      <option value="diag">CBOR Diagnostic</option>
                    </select>
                    <UButton
                      icon="i-heroicons-clipboard-document"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="copyToClipboard(envelopeOutputMode === 'notation' ? notationOutput : envelopeOutputMode === 'hex' ? hexOutput : diagnosticOutput, envelopeOutputMode === 'notation' ? 'Envelope notation' : envelopeOutputMode === 'hex' ? 'CBOR hex' : 'CBOR diagnostic')"
                    />
                  </div>
                </div>
                <pre v-if="envelopeOutputMode === 'notation' && notationOutput" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">{{ notationOutput }}</pre>
                <div v-else-if="envelopeOutputMode === 'hex' && hexOutput" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-600 dark:text-gray-400 break-all max-h-48 overflow-y-auto">
                  {{ hexOutput }}
                </div>
                <pre v-else-if="envelopeOutputMode === 'diag' && diagnosticOutput" class="bg-gray-100 dark:bg-gray-800/50 rounded-lg p-3 text-xs font-mono text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre">{{ diagnosticOutput }}</pre>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- QR Modal -->
      <UModal v-model:open="showQRModal" title="QR Code" description="Scan this QR code to import the XID on another device.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">XID QR Code</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Scan this QR code to import the XID envelope on another device.
            </p>

            <UAlert
              v-if="qrCodeError"
              color="error"
              variant="soft"
              icon="i-heroicons-exclamation-triangle"
              :title="qrCodeError"
              class="mb-4"
            />

            <div v-if="qrCodeDataUrl" class="flex flex-col items-center">
              <div class="bg-white p-4 rounded-lg mb-4">
                <img :src="qrCodeDataUrl" alt="XID QR Code" class="w-64 h-64">
              </div>

              <p class="text-xs text-gray-500 text-center mb-4">
                Format: UR (Uniform Resource)
              </p>

              <div class="flex gap-2">
                <UButton color="neutral" variant="soft" @click="downloadQRCode">
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
                  Download SVG
                </UButton>
              </div>
            </div>

            <div v-else-if="!qrCodeError" class="flex justify-center py-8">
              <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
            </div>

            <div class="flex justify-end mt-6">
              <UButton color="neutral" variant="ghost" @click="showQRModal = false">
                Close
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Add Key Modal -->
      <UModal v-model:open="showAddKeyModal" title="Add Key" description="Generate a new cryptographic key for this XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Key</h3>

            <!-- Algorithm Selection -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Algorithm</label>
              <select v-model="newKeyScheme" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
                <option value="Ed25519">Ed25519 (EdDSA)</option>
                <option value="Schnorr">Schnorr (secp256k1)</option>
                <option value="ECDSA">ECDSA (secp256k1)</option>
              </select>
            </div>

            <!-- Nickname -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nickname (optional)</label>
              <input v-model="newKeyNickname" type="text" placeholder="e.g., Backup Key" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Permissions Grid -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div class="font-medium text-gray-500">Privilege</div>
                <div class="font-medium text-gray-500 text-center">Allow</div>
                <div class="font-medium text-gray-500 text-center">Deny</div>
                <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                  <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                  <div class="text-center"><input type="checkbox" :checked="newKeyAllowPrivileges.has(priv)" @change="togglePrivilege(newKeyAllowPrivileges, priv)"></div>
                  <div class="text-center"><input type="checkbox" :checked="newKeyDenyPrivileges.has(priv)" @change="togglePrivilege(newKeyDenyPrivileges, priv)"></div>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAddKeyModal = false">Cancel</UButton>
              <UButton color="primary" @click="addNewKey">
                <UIcon name="i-heroicons-key" class="w-4 h-4 mr-1" />
                Generate Key
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Remove Key Confirmation -->
      <UModal v-model:open="showRemoveKeyConfirm" title="Remove Key" description="Confirm key removal from the XID document.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Key?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will remove the key from the XID document. This action cannot be undone.
            </p>
            <div v-if="removeKeyTarget" class="text-xs font-mono bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-4 text-gray-600 dark:text-gray-400">
              {{ removeKeyTarget.nickname() || getKeyRefHex(removeKeyTarget) }}
            </div>
            <UAlert v-if="removeKeyError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="removeKeyError" class="mb-4" />
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showRemoveKeyConfirm = false">Cancel</UButton>
              <UButton color="error" :disabled="!!removeKeyError" @click="executeRemoveKey">Remove</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Add Delegate Modal -->
      <UModal v-model:open="showAddDelegateModal" title="Add Delegate" description="Add a new delegate to this XID document.">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Add Delegate</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              A new XID document will be generated for the delegate. Configure its permissions below.
            </p>

            <!-- Permissions Grid -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div class="font-medium text-gray-500">Privilege</div>
                <div class="font-medium text-gray-500 text-center">Allow</div>
                <div class="font-medium text-gray-500 text-center">Deny</div>
                <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                  <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                  <div class="text-center"><input type="checkbox" :checked="newDelegateAllowPrivileges.has(priv)" @change="togglePrivilege(newDelegateAllowPrivileges, priv)"></div>
                  <div class="text-center"><input type="checkbox" :checked="newDelegateDenyPrivileges.has(priv)" @change="togglePrivilege(newDelegateDenyPrivileges, priv)"></div>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showAddDelegateModal = false">Cancel</UButton>
              <UButton color="primary" @click="addNewDelegate">
                <UIcon name="i-heroicons-user-plus" class="w-4 h-4 mr-1" />
                Add Delegate
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Remove Delegate Confirmation -->
      <UModal v-model:open="showRemoveDelegateConfirm" title="Remove Delegate" description="Confirm delegate removal from the XID document.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Delegate?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will remove the delegate from the XID document. This action cannot be undone.
            </p>
            <div v-if="removeDelegateTarget" class="text-xs font-mono bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-4 text-gray-600 dark:text-gray-400">
              {{ getDelegateXidHex(removeDelegateTarget) }}
            </div>
            <UAlert v-if="removeDelegateError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="removeDelegateError" class="mb-4" />
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showRemoveDelegateConfirm = false">Cancel</UButton>
              <UButton color="error" :disabled="!!removeDelegateError" @click="executeRemoveDelegate">Remove</UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Service Modal (Add/Edit) -->
      <UModal v-model:open="showServiceModal" :title="serviceModalMode === 'add' ? 'Add Service' : 'Edit Service'" :description="serviceModalMode === 'add' ? 'Add a new service endpoint.' : 'Edit service configuration.'">
        <template #content>
          <div class="p-6 space-y-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{{ serviceModalMode === 'add' ? 'Add Service' : 'Edit Service' }}</h3>

            <UAlert v-if="serviceFormError" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :title="serviceFormError" />

            <!-- URI -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URI</label>
              <input
                v-model="serviceFormUri"
                type="text"
                placeholder="https://example.com/api"
                :disabled="serviceModalMode === 'edit'"
                class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2"
                :class="serviceModalMode === 'edit' ? 'opacity-60 cursor-not-allowed' : ''"
              >
            </div>

            <!-- Name -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name (optional)</label>
              <input v-model="serviceFormName" type="text" placeholder="e.g., Messaging Service" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Capability -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capability (optional)</label>
              <input v-model="serviceFormCapability" type="text" placeholder="e.g., com.example.messaging" class="w-full text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2">
            </div>

            <!-- Key References -->
            <div v-if="keyList.length > 0">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Key References</label>
              <div class="space-y-1 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div v-for="keyItem in keyList" :key="'svc-key-' + getKeyRefHex(keyItem)" class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="serviceFormKeyRefs.has(getKeyRefHex(keyItem))"
                    @change="togglePrivilege(serviceFormKeyRefs, getKeyRefHex(keyItem))"
                  >
                  <UBadge color="neutral" variant="soft" size="xs">{{ getKeyAlgorithm(keyItem) }}</UBadge>
                  <span class="text-xs text-gray-700 dark:text-gray-300">{{ keyItem.nickname() || getKeyRefHex(keyItem).substring(0, 12) + '...' }}</span>
                  <UBadge v-if="isKeyInception(keyItem)" color="success" variant="soft" size="xs">Inception</UBadge>
                </div>
              </div>
            </div>

            <!-- Delegate References -->
            <div v-if="delegateList.length > 0">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Delegate References</label>
              <div class="space-y-1 bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div v-for="delegateItem in delegateList" :key="'svc-del-' + getDelegateXidHex(delegateItem)" class="flex items-center gap-2">
                  <input
                    type="checkbox"
                    :checked="serviceFormDelegateRefs.has(getDelegateRefHex(delegateItem))"
                    @change="togglePrivilege(serviceFormDelegateRefs, getDelegateRefHex(delegateItem))"
                  >
                  <UBadge color="info" variant="soft" size="xs">Delegate</UBadge>
                  <span class="text-xs text-gray-700 dark:text-gray-300 font-mono">{{ getDelegateXidHex(delegateItem).substring(0, 12) }}...</span>
                </div>
              </div>
            </div>

            <!-- Permissions Grid -->
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div class="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-xs bg-gray-50 dark:bg-gray-800/30 rounded-lg p-3">
                <div class="font-medium text-gray-500">Privilege</div>
                <div class="font-medium text-gray-500 text-center">Allow</div>
                <div class="font-medium text-gray-500 text-center">Deny</div>
                <template v-for="priv in ALL_PRIVILEGES" :key="priv">
                  <div class="text-gray-700 dark:text-gray-300">{{ priv }}</div>
                  <div class="text-center"><input type="checkbox" :checked="serviceFormAllowPrivileges.has(priv)" @change="togglePrivilege(serviceFormAllowPrivileges, priv)"></div>
                  <div class="text-center"><input type="checkbox" :checked="serviceFormDenyPrivileges.has(priv)" @change="togglePrivilege(serviceFormDenyPrivileges, priv)"></div>
                </template>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <UButton color="neutral" variant="ghost" @click="showServiceModal = false">Cancel</UButton>
              <UButton color="primary" @click="saveService">
                <UIcon name="i-heroicons-server-stack" class="w-4 h-4 mr-1" />
                {{ serviceModalMode === 'add' ? 'Add Service' : 'Save Changes' }}
              </UButton>
            </div>
          </div>
        </template>
      </UModal>

      <!-- Remove Service Confirmation -->
      <UModal v-model:open="showRemoveServiceConfirm" title="Remove Service" description="Confirm service removal from the XID document.">
        <template #content>
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove Service?</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              This will remove the service from the XID document. This action cannot be undone.
            </p>
            <div v-if="removeServiceTargetUri" class="text-xs font-mono bg-gray-100 dark:bg-gray-800/50 rounded p-2 mb-4 text-gray-600 dark:text-gray-400">
              {{ removeServiceTargetUri }}
            </div>
            <div class="flex justify-end gap-2">
              <UButton color="neutral" variant="ghost" @click="showRemoveServiceConfirm = false">Cancel</UButton>
              <UButton color="error" @click="executeRemoveService">Remove</UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
