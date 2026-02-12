import { XIDDocument, XIDPrivateKeyOptions, XIDGeneratorOptions, XIDVerifySignature, Key, Service, Privilege, type XIDGenesisMarkOptions } from '@bcts/xid'
import { Envelope } from '@bcts/envelope'
import { ProvenanceMarkResolution } from '@bcts/provenance-mark'

type AttachmentEnvelope = Envelope & {
  attachmentVendor(): string
  attachmentConformsTo(): string | undefined
  attachmentPayload(): Envelope
}

const STORAGE_KEY = 'xid-tutorial-state'

const xidDocument = shallowRef<XIDDocument | null>(null)
const docVersion = ref<number>(0)
const currentStep = ref<number>(0)
const stepsCompleted = ref<boolean[]>([false, false, false, false])
const error = ref<string | null>(null)

const xidHex = ref('')
const xidUrString = ref('')
const xidBytewords = ref('')
const xidBytemojis = ref('')

const treeOutput = ref('')
const hexOutput = ref('')
const notationOutput = ref('')
const diagnosticOutput = ref('')
const envelopeUrOutput = ref('')

let restored = false

export function useXidTutorial() {
  const keyList = computed(() => {
    void docVersion.value
    return xidDocument.value?.keys() ?? []
  })

  const resolutionMethodList = computed(() => {
    void docVersion.value
    return xidDocument.value ? Array.from(xidDocument.value.resolutionMethods()) : []
  })

  const attachmentList = computed(() => {
    void docVersion.value
    if (!xidDocument.value) return [] as { digestHex: string, vendor: string, payloadPreview: string }[]
    const results: { digestHex: string, vendor: string, payloadPreview: string }[] = []
    for (const [digestHex, envelope] of xidDocument.value.getAttachments().iter()) {
      let vendor = '(unknown)'
      let payloadPreview = ''
      try { vendor = (envelope as AttachmentEnvelope).attachmentVendor() } catch {}
      try {
        const payload = (envelope as AttachmentEnvelope).attachmentPayload()
        const text = (payload as unknown as { asText(): string | undefined }).asText()
        payloadPreview = text ?? '(binary data)'
      } catch { payloadPreview = '(binary data)' }
      results.push({ digestHex, vendor, payloadPreview })
    }
    return results
  })

  const serviceList = computed(() => {
    void docVersion.value
    return xidDocument.value?.services() ?? []
  })

  const provenanceMark = computed(() => {
    void docVersion.value
    return xidDocument.value?.provenance() ?? null
  })

  if (import.meta.client && !restored) {
    restored = true
    restoreState()
  }

  function clearIdentity() { xidHex.value = ''; xidUrString.value = ''; xidBytewords.value = ''; xidBytemojis.value = '' }
  function clearOutput() { treeOutput.value = ''; hexOutput.value = ''; notationOutput.value = ''; diagnosticOutput.value = ''; envelopeUrOutput.value = '' }

  function updateIdentityDisplay() {
    const doc = xidDocument.value
    if (!doc) { clearIdentity(); return }
    const xid = doc.xid()
    xidHex.value = xid.toHex()
    xidUrString.value = xid.urString()
    xidBytewords.value = xid.bytewordsIdentifier(true)
    xidBytemojis.value = xid.bytemojisIdentifier(true)
  }

  function updateOutput() {
    const doc = xidDocument.value
    if (!doc) { clearOutput(); return }
    try {
      const envelope = doc.toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, { type: 'none' })
      treeOutput.value = envelope.treeFormat()
      notationOutput.value = envelope.format()
      diagnosticOutput.value = envelope.diagnostic()
      hexOutput.value = Array.from(envelope.cborBytes()).map(b => b.toString(16).padStart(2, '0')).join('')
      envelopeUrOutput.value = envelope.urString()
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to build envelope'
      clearOutput()
    }
  }

  function refreshDocument() {
    docVersion.value++
    updateIdentityDisplay()
    updateOutput()
  }

  function saveState() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step: currentStep.value, stepsCompleted: stepsCompleted.value, xidUr: getPrivateEnvelope()?.urString(),
      }))
    } catch {}
  }

  function restoreState() {
    if (!import.meta.client) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const { step, stepsCompleted: sc, xidUr } = JSON.parse(raw)
      currentStep.value = step ?? 0
      stepsCompleted.value = sc ?? [false, false, false, false]
      if (xidUr) {
        const envelope = (Envelope as unknown as { fromURString(s: string): Envelope }).fromURString(xidUr)
        xidDocument.value = XIDDocument.fromEnvelope(envelope)
        refreshDocument()
      }
    } catch {}
  }

  function createXid(nickname: string, scheme: 'Ed25519' | 'Schnorr' | 'ECDSA', withProvenance: boolean, passphrase?: string) {
    try {
      error.value = null
      const markOptions: XIDGenesisMarkOptions = withProvenance && passphrase
        ? { type: 'passphrase', passphrase, resolution: ProvenanceMarkResolution.High, date: new Date() }
        : { type: 'none' }
      const doc = XIDDocument.new({ type: 'default' }, markOptions)
      const key = doc.inceptionKey()
      if (key) doc.setNameForKey(key.publicKeys(), nickname)
      xidDocument.value = doc
      updateIdentityDisplay()
      updateOutput()
      completeStep(0)
      saveState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to create XID document'
    }
  }

  function addResolutionMethod(uri: string) {
    const doc = xidDocument.value
    if (!doc) return
    try {
      doc.addResolutionMethod(uri)
      refreshDocument()
      saveState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add resolution method'
    }
  }

  function advanceProvenance() {
    const doc = xidDocument.value
    if (!doc) return
    try {
      doc.nextProvenanceMarkWithEmbeddedGenerator(undefined, new Date())
      refreshDocument()
      saveState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to advance provenance'
    }
  }

  function addAttachment(payload: string, vendor: string, conformsTo?: string) {
    const doc = xidDocument.value
    if (!doc) return
    try {
      doc.addAttachment(payload, vendor, conformsTo)
      refreshDocument()
      saveState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add attachment'
    }
  }

  function addService(uri: string, name: string, capability: string, keyRefHex?: string) {
    const doc = xidDocument.value
    if (!doc) return
    try {
      const service = Service.new(uri)
      if (name) service.setName(name)
      if (capability) service.setCapability(capability)
      if (keyRefHex) {
        service.addKeyReferenceHex(keyRefHex)
        service.permissionsMut().addAllow(Privilege.All)
      }
      doc.addService(service)
      refreshDocument()
      saveState()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to add service'
    }
  }

  function completeStep(step: number) {
    stepsCompleted.value = [...stepsCompleted.value.map((v, i) => i === step ? true : v)]
    saveState()
  }

  function completeAndAdvance(step: number) {
    completeStep(step)
    if (step < 3) currentStep.value = step + 1
  }

  function goToStep(step: number) {
    currentStep.value = step
  }

  function resetTutorial() {
    xidDocument.value = null
    docVersion.value = 0
    currentStep.value = 0
    stepsCompleted.value = [false, false, false, false]
    error.value = null
    clearIdentity()
    clearOutput()
    if (import.meta.client) localStorage.removeItem(STORAGE_KEY)
  }

  function getPublicEnvelope(): Envelope | null {
    if (!xidDocument.value) return null
    try { return xidDocument.value.toEnvelope(XIDPrivateKeyOptions.Omit, XIDGeneratorOptions.Omit, { type: 'none' }) } catch { return null }
  }

  function getPrivateEnvelope(): Envelope | null {
    if (!xidDocument.value) return null
    try { return xidDocument.value.toEnvelope(XIDPrivateKeyOptions.Include, XIDGeneratorOptions.Include, { type: 'inception' }) } catch { return null }
  }

  function verifySignature(): boolean {
    try {
      const envelope = getPublicEnvelope()
      if (!envelope) return false
      XIDDocument.fromEnvelope(envelope, undefined, XIDVerifySignature.Inception)
      return true
    } catch { return false }
  }

  function getKeyAlgorithm(key: Key): string {
    try { return key.publicKeys().signingPublicKey().keyType() } catch { return 'Unknown' }
  }

  function getKeyRefHex(key: Key): string { return key.reference().toHex() }

  return {
    xidDocument,
    docVersion,
    currentStep,
    stepsCompleted,
    error,
    xidHex,
    xidUrString,
    xidBytewords,
    xidBytemojis,
    treeOutput,
    hexOutput,
    notationOutput,
    diagnosticOutput,
    envelopeUrOutput,
    keyList,
    resolutionMethodList,
    attachmentList,
    serviceList,
    provenanceMark,
    createXid,
    addResolutionMethod,
    advanceProvenance,
    addAttachment,
    addService,
    completeStep,
    completeAndAdvance,
    goToStep,
    resetTutorial,
    getPublicEnvelope,
    getPrivateEnvelope,
    verifySignature,
    getKeyAlgorithm,
    getKeyRefHex,
  }
}
