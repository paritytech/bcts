<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = ref(false)
const handleExampleSelect = inject<((example: { format: 'hex' | 'ur', value: string }) => void) | undefined>('handleExampleSelect')

const navigationItems: NavigationMenuItem[] = [
  {
    label: 'Examples',
    type: 'label'
  },
  {
    label: 'Simple Object',
    icon: 'i-heroicons-cube',
    onSelect: () => {
      handleExampleSelect?.({
        format: 'hex',
        value: 'a2626964187b646e616d65684a6f686e20446f65'
      })
      open.value = false
    }
  },
  {
    label: 'Collection',
    icon: 'i-heroicons-rectangle-stack',
    onSelect: () => {
      handleExampleSelect?.({
        format: 'hex',
        value: 'a2646e616d656d4d7920436f6c6c656374696f6e65757365727382d86fa262696401646e616d6571c4b07266616e2042696c616c6fc49f6c75d86fa262696402646e616d6572506965746572205579747465727370726f74'
      })
      open.value = false
    }
  },
  {
    label: 'Single UR',
    icon: 'i-heroicons-link',
    onSelect: () => {
      handleExampleSelect?.({
        format: 'ur',
        value: 'ur:link3/pdihjzinjtjejklyoeiakpjpjzksdtisjyjyjojkftdldlktktktdmjzinjtjeihieinjtdmiajljndlinjtdljzihjlioiakpjkjyjlieinjldlihjyinjyjzihisgsinjtjeihiegajtihjyisihjnihjeiehsjpjedpiyjljpihjkjyihjyinjyjzihjsfzjzihjljthsjpiejliakpjkjyjlieinjliyhskohsjyhsjpksfeinjoiyjkftdldlidhsiyjeeyidknhsiaihiaidkoimkshsimjpjlideyiojojlecjnjseejojseeidemjsidkojsjyjeiaenjseckkemjnjtjyisktjejpieimhseyisjojpenjsjkimjokpidjziniahejeihkkynimjyinjyjzihheiyjljtjyiofygtcxguhsjtjkimjyinjyjzihhejkinknihihjkjnhsjzjzjejyinjyjzihheiajljzjljpiocnfgfgfgfgfgfgvwylneoe'
      })
      open.value = false
    }
  },
  {
    label: 'Gordian Envelope',
    icon: 'i-heroicons-envelope',
    onSelect: () => {
      handleExampleSelect?.({
        format: 'ur',
        value: 'ur:envelope/lntpsoksdkgmihjskpihjkjyinjtiocxehdycxfygwghcxiyjljpcxinjtkojliniaihcxcneheyeoeeecoytpsoinjyinjnihjkjyhsjnjotpsosecyinembgieoyahtpsotansgulftansfwlshddahygytnrdaerovwleaycmleeszmckdyisntrhloioltyndeptimrhtkpdsbinvevweolyswfzhggstartahisdebahfteldvdqzoegdfsonmyhhvssksknewnltmtmyaykstacetansgrhdcxhpkbzetyjywsmtjoghwplbcttpwndlgeyaptempazsidflwskstpnllrykeofzkpoytpsoiminjtkojliniaihdpinietpsoiheheyeoeeecoytpsojeiyjpjljndpkthsjzjzihjytpsotansgylftanshfhdcxynisgskboxmesrfeclgddrfnteimknwmmutnehqzpfbdyawkrheovlykpacwfyemtansgrhdcxjsbnolswhpztpdbwkionlbdpwknnrseyskpmwmvoktsbkolechfggsihwdryfgfwoyaxtpsotansghhdfzrlctjkghvsjomodwmnuooytbfpectnpeynrshtfplprydkjnrldmvamojkmkbeteotlgbghtdngodkryhlwpvydewfdsstlnqztbzccxmyvdckmurddppasfpksazsdiytmylbtt'
      })
      open.value = false
    }
  },
  {
    type: 'separator'
  } as unknown as NavigationMenuItem,
  {
    label: 'APIs',
    type: 'label'
  },
  {
    label: 'components',
    icon: 'i-heroicons-puzzle-piece',
    to: 'https://dcbor.custodio.me/docs/components',
    target: '_blank'
  },
  {
    label: 'crypto',
    icon: 'i-heroicons-lock-closed',
    to: 'https://dcbor.custodio.me/docs/crypto',
    target: '_blank'
  },
  {
    label: 'dcbor',
    icon: 'i-heroicons-code-bracket',
    to: 'https://dcbor.custodio.me/docs/dcbor',
    target: '_blank'
  },
  {
    label: 'envelope',
    icon: 'i-heroicons-envelope',
    to: 'https://dcbor.custodio.me/docs/envelope',
    target: '_blank'
  },
  {
    label: 'known-values',
    icon: 'i-heroicons-bookmark',
    to: 'https://dcbor.custodio.me/docs/known-values',
    target: '_blank'
  },
  {
    label: 'provenance-mark',
    icon: 'i-heroicons-shield-check',
    to: 'https://dcbor.custodio.me/docs/provenance-mark',
    target: '_blank'
  },
  {
    label: 'rand',
    icon: 'i-heroicons-arrow-path',
    to: 'https://dcbor.custodio.me/docs/rand',
    target: '_blank'
  },
  {
    label: 'shamir',
    icon: 'i-heroicons-key',
    to: 'https://dcbor.custodio.me/docs/shamir',
    target: '_blank'
  },
  {
    label: 'sskr',
    icon: 'i-heroicons-squares-2x2',
    to: 'https://dcbor.custodio.me/docs/sskr',
    target: '_blank'
  },
  {
    label: 'tags',
    icon: 'i-heroicons-tag',
    to: 'https://dcbor.custodio.me/docs/tags',
    target: '_blank'
  },
  {
    label: 'uniform-resources',
    icon: 'i-heroicons-qr-code',
    to: 'https://dcbor.custodio.me/docs/uniform-resources',
    target: '_blank'
  },
  {
    label: 'xid',
    icon: 'i-heroicons-identification',
    to: 'https://dcbor.custodio.me/docs/xid',
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
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header>
          <h2 class="font-semibold text-gray-900 dark:text-white">Blockchain Commons</h2>
      </template>

      <template #default="{ collapsed }">
          <UNavigationMenu
            :collapsed="collapsed"
            :items="navigationItems"
            orientation="vertical"
            tooltip
            popover
          />
      </template>

    </UDashboardSidebar>

    <slot />

  </UDashboardGroup>
</template>
