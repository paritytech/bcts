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
    to: '/registry',
    badge: 'WIP'
  },
  {
    label: 'Envelope Builder',
    icon: 'i-heroicons-cube-transparent',
    to: '/envelope-builder',
    badge: 'WIP'
  },
  {
    type: 'label',
    label: 'Examples'
  },
  {
    label: 'Data Structures',
    icon: 'i-heroicons-play-circle',
    defaultOpen: false,
    children: [
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
      }
    ]
  },
  {
    label: 'TypeScript Code',
    icon: 'i-heroicons-code-bracket-square',
    defaultOpen: false,
    children: [
      {
        label: 'Selective Disclosure',
        icon: 'i-heroicons-eye',
        to: 'https://github.com/leonardocustodio/bcts/blob/main/apps/examples/src/selective-disclosure.ts',
        target: '_blank'
      },
      {
        label: 'Sealed Messages',
        icon: 'i-heroicons-envelope',
        to: 'https://github.com/leonardocustodio/bcts/blob/main/apps/examples/src/sealed-message-multi-recipient.ts',
        target: '_blank'
      },
      {
        label: 'Private Asserts',
        icon: 'i-heroicons-lock-closed',
        to: 'https://github.com/leonardocustodio/bcts/blob/main/apps/examples/src/per-assertion-encryption.ts',
        target: '_blank'
      }
    ]
  },
  {
    type: 'label',
    label: 'Resources'
  },
  {
    label: 'API References',
    icon: 'i-heroicons-book-open',
    defaultOpen: false,
    children: [
      {
        label: 'components',
        icon: 'i-heroicons-puzzle-piece',
        to: 'https://bcts.dev/docs/components',
        target: '_blank'
      },
      {
        label: 'crypto',
        icon: 'i-heroicons-lock-closed',
        to: 'https://bcts.dev/docs/crypto',
        target: '_blank'
      },
      {
        label: 'dcbor',
        icon: 'i-heroicons-code-bracket',
        to: 'https://bcts.dev/docs/dcbor',
        target: '_blank'
      },
      {
        label: 'envelope',
        icon: 'i-heroicons-envelope',
        to: 'https://bcts.dev/docs/envelope',
        target: '_blank'
      },
      {
        label: 'known-values',
        icon: 'i-heroicons-bookmark',
        to: 'https://bcts.dev/docs/known-values',
        target: '_blank'
      },
      {
        label: 'provenance-mark',
        icon: 'i-heroicons-shield-check',
        to: 'https://bcts.dev/docs/provenance-mark',
        target: '_blank'
      },
      {
        label: 'rand',
        icon: 'i-heroicons-arrow-path',
        to: 'https://bcts.dev/docs/rand',
        target: '_blank'
      },
      {
        label: 'shamir',
        icon: 'i-heroicons-key',
        to: 'https://bcts.dev/docs/shamir',
        target: '_blank'
      },
      {
        label: 'sskr',
        icon: 'i-heroicons-squares-2x2',
        to: 'https://bcts.dev/docs/sskr',
        target: '_blank'
      },
      {
        label: 'tags',
        icon: 'i-heroicons-tag',
        to: 'https://bcts.dev/docs/tags',
        target: '_blank'
      },
      {
        label: 'uniform-resources',
        icon: 'i-heroicons-qr-code',
        to: 'https://bcts.dev/docs/uniform-resources',
        target: '_blank'
      },
      {
        label: 'xid',
        icon: 'i-heroicons-identification',
        to: 'https://bcts.dev/docs/xid',
        target: '_blank'
      }
    ]
  }
]

const bottomNavigationItems: NavigationMenuItem[] = [
  {
    label: 'Help & Support',
    icon: 'i-heroicons-question-mark-circle',
    to: 'https://github.com/leonardocustodio/bcts/issues/new',
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
