<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const route = useRoute()
const router = useRouter()
const open = ref(false)

const selectedExample = ref<{ name: string, format: 'hex' | 'ur', value: string } | null>(null)
provide('selectedExample', selectedExample)

// Helper to select an example and navigate to playground if needed
function selectExample(example: { name: string, format: 'hex' | 'ur', value: string }) {
  selectedExample.value = example
  open.value = false
  if (route.path !== '/') {
    router.push('/')
  }
}

const navigationItems: NavigationMenuItem[] = [
  {
    type: 'label',
    label: 'Tools'
  },
  {
    label: 'Data Playground',
    icon: 'i-heroicons-command-line',
    to: '/'
  },
  {
    label: 'Registry Browser',
    icon: 'i-heroicons-circle-stack',
    to: '/registry'
  },
  {
    label: 'Envelope Builder',
    icon: 'i-heroicons-cube-transparent',
    to: '/envelope-builder',
    badge: 'WIP'
  },
  {
    type: 'label',
    label: 'Learn'
  },
  {
    label: 'XID Tutorial',
    icon: 'i-heroicons-academic-cap',
    to: '/xid-tutorial',
    badge: 'WIP'
  },
  {
    type: 'label',
    label: 'Examples'
  },
  {
    label: 'Simple Object',
    icon: 'i-heroicons-cube',
    onSelect: () => selectExample({
      name: 'Simple Object',
      format: 'hex',
      value: 'a2626964187b646e616d65684a6f686e20446f65'
    })
  },
  {
    label: 'Collection',
    icon: 'i-heroicons-rectangle-stack',
    onSelect: () => selectExample({
      name: 'Collection',
      format: 'hex',
      value: 'a2646e616d656d4d7920436f6c6c656374696f6e65757365727382d86fa262696401646e616d6571c4b07266616e2042696c616c6fc49f6c75d86fa262696402646e616d6572506965746572205579747465727370726f74'
    })
  },
  {
    label: 'Single UR',
    icon: 'i-heroicons-link',
    onSelect: () => selectExample({
      name: 'Single UR',
      format: 'ur',
      value: 'ur:link3/pdihjzinjtjejklyoeiakpjpjzksdtisjyjyjojkftdldlktktktdmjzinjtjeihieinjtdmiajljndlinjtdljzihjlioiakpjkjyjlieinjldlihjyinjyjzihisgsinjtjeihiegajtihjyisihjnihjeiehsjpjedpiyjljpihjkjyihjyinjyjzihjsfzjzihjljthsjpiejliakpjkjyjlieinjliyhskohsjyhsjpksfeinjoiyjkftdldlidhsiyjeeyidknhsiaihiaidkoimkshsimjpjlideyiojojlecjnjseejojseeidemjsidkojsjyjeiaenjseckkemjnjtjyisktjejpieimhseyisjojpenjsjkimjokpidjziniahejeihkkynimjyinjyjzihheiyjljtjyiofygtcxguhsjtjkimjyinjyjzihhejkinknihihjkjnhsjzjzjejyinjyjzihheiajljzjljpiocnfgfgfgfgfgfgvwylneoe'
    })
  },
  {
    label: 'Gordian Envelope',
    icon: 'i-heroicons-envelope',
    onSelect: () => selectExample({
      name: 'Gordian Envelope',
      format: 'ur',
      value: 'ur:envelope/lntpsoksdkgmihjskpihjkjyinjtiocxehdycxfygwghcxiyjljpcxinjtkojliniaihcxcneheyeoeeecoytpsoinjyinjnihjkjyhsjnjotpsosecyinembgieoyahtpsotansgulftansfwlshddahygytnrdaerovwleaycmleeszmckdyisntrhloioltyndeptimrhtkpdsbinvevweolyswfzhggstartahisdebahfteldvdqzoegdfsonmyhhvssksknewnltmtmyaykstacetansgrhdcxhpkbzetyjywsmtjoghwplbcttpwndlgeyaptempazsidflwskstpnllrykeofzkpoytpsoiminjtkojliniaihdpinietpsoiheheyeoeeecoytpsojeiyjpjljndpkthsjzjzihjytpsotansgylftanshfhdcxynisgskboxmesrfeclgddrfnteimknwmmutnehqzpfbdyawkrheovlykpacwfyemtansgrhdcxjsbnolswhpztpdbwkionlbdpwknnrseyskpmwmvoktsbkolechfggsihwdryfgfwoyaxtpsotansghhdfzrlctjkghvsjomodwmnuooytbfpectnpeynrshtfplprydkjnrldmvamojkmkbeteotlgbghtdngodkryhlwpvydewfdsstlnqztbzccxmyvdckmurddppasfpksazsdiytmylbtt'
    })
  },
  {
    type: 'label',
    label: 'Resources'
  },
  {
    label: 'CBOR Book',
    icon: 'i-heroicons-book-open',
    to: 'https://cborbook.com/',
    target: '_blank'
  },
  {
    label: 'BC Dev Docs',
    icon: 'i-heroicons-document-text',
    to: 'https://developer.blockchaincommons.com/',
    target: '_blank'
  },
  {
    label: 'BC YouTube',
    icon: 'i-heroicons-play-circle',
    to: 'https://www.youtube.com/@blockchaincommons',
    target: '_blank'
  },
  {
    label: 'API References',
    icon: 'i-heroicons-book-open',
    defaultOpen: false,
    children: [
      {
        label: 'components',
        icon: 'i-heroicons-puzzle-piece',
        to: 'https://docs.bcts.dev/api/components',
        target: '_blank'
      },
      {
        label: 'crypto',
        icon: 'i-heroicons-lock-closed',
        to: 'https://docs.bcts.dev/api/crypto',
        target: '_blank'
      },
      {
        label: 'dcbor',
        icon: 'i-heroicons-code-bracket',
        to: 'https://docs.bcts.dev/api/dcbor',
        target: '_blank'
      },
      {
        label: 'dcbor-parse',
        icon: 'i-heroicons-code-bracket-square',
        to: 'https://docs.bcts.dev/api/dcbor-parse',
        target: '_blank'
      },
      {
        label: 'dcbor-pattern',
        icon: 'i-heroicons-variable',
        to: 'https://docs.bcts.dev/api/dcbor-pattern',
        target: '_blank'
      },
      {
        label: 'envelope',
        icon: 'i-heroicons-envelope',
        to: 'https://docs.bcts.dev/api/envelope',
        target: '_blank'
      },
      {
        label: 'envelope-pattern',
        icon: 'i-heroicons-document-magnifying-glass',
        to: 'https://docs.bcts.dev/api/envelope-pattern',
        target: '_blank'
      },
      {
        label: 'frost-hubert',
        icon: 'i-heroicons-shield-exclamation',
        to: 'https://docs.bcts.dev/api/frost-hubert',
        target: '_blank'
      },
      {
        label: 'gstp',
        icon: 'i-heroicons-globe-alt',
        to: 'https://docs.bcts.dev/api/gstp',
        target: '_blank'
      },
      {
        label: 'hubert',
        icon: 'i-heroicons-finger-print',
        to: 'https://docs.bcts.dev/api/hubert',
        target: '_blank'
      },
      {
        label: 'known-values',
        icon: 'i-heroicons-bookmark',
        to: 'https://docs.bcts.dev/api/known-values',
        target: '_blank'
      },
      {
        label: 'lifehash',
        icon: 'i-heroicons-sparkles',
        to: 'https://docs.bcts.dev/api/lifehash',
        target: '_blank'
      },
      {
        label: 'provenance-mark',
        icon: 'i-heroicons-shield-check',
        to: 'https://docs.bcts.dev/api/provenance-mark',
        target: '_blank'
      },
      {
        label: 'rand',
        icon: 'i-heroicons-arrow-path',
        to: 'https://docs.bcts.dev/api/rand',
        target: '_blank'
      },
      {
        label: 'shamir',
        icon: 'i-heroicons-key',
        to: 'https://docs.bcts.dev/api/shamir',
        target: '_blank'
      },
      {
        label: 'sskr',
        icon: 'i-heroicons-squares-2x2',
        to: 'https://docs.bcts.dev/api/sskr',
        target: '_blank'
      },
      {
        label: 'tags',
        icon: 'i-heroicons-tag',
        to: 'https://docs.bcts.dev/api/tags',
        target: '_blank'
      },
      {
        label: 'uniform-resources',
        icon: 'i-heroicons-qr-code',
        to: 'https://docs.bcts.dev/api/uniform-resources',
        target: '_blank'
      },
      {
        label: 'xid',
        icon: 'i-heroicons-identification',
        to: 'https://docs.bcts.dev/api/xid',
        target: '_blank'
      }
    ]
  }
]

const bottomNavigationItems: NavigationMenuItem[] = [
  {
    label: 'Help & Support',
    icon: 'i-heroicons-question-mark-circle',
    to: 'https://github.com/paritytech/bcts/issues/new',
    target: '_blank'
  }
]
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-gray-50 dark:bg-gray-900"
      :ui="{ footer: 'lg:border-t lg:border-gray-200 dark:lg:border-gray-800/50' }"
    >
      <template #header="{ collapsed }">
        <div :class="['flex items-center', collapsed ? 'justify-center w-full' : 'gap-2']">
          <BctsLogo width="24" height="24" />
          <h2 v-if="!collapsed" class="font-semibold text-gray-900 dark:text-white">BCTS IDE</h2>
        </div>
      </template>

      <template #default="{ collapsed }">
          <UNavigationMenu
            :collapsed="collapsed"
            :items="navigationItems"
            :external-icon="false"
            orientation="vertical"
            tooltip
            popover
          />

          <UNavigationMenu
            :collapsed="collapsed"
            :items="bottomNavigationItems"
            :external-icon="false"
            orientation="vertical"
            tooltip
            popover
            class="mt-auto"
          />
      </template>

    </UDashboardSidebar>

    <slot />

  </UDashboardGroup>
</template>
