<script setup lang="ts">
import { NovaButton, NovaField } from '../src'

defineProps<{ draft: string; busy: boolean; error: string; actions?: boolean; id?: string }>()
const emit = defineEmits<{ 'update:draft': [draft: string]; submit: [event: Event] }>()
</script>

<template>
  <form
    :id="id"
    aria-label="发布评论"
    class="demo-scene-form"
    @submit.prevent="emit('submit', $event)"
  >
    <NovaField
      :model-value="draft"
      as="textarea"
      label="发表评论"
      :rows="4"
      :maxlength="500"
      :disabled="busy"
      placeholder="分享你的经验或最近的发现…"
      :hint="`已输入 ${draft.length}/500 字符`"
      :error="error"
      @update:model-value="emit('update:draft', $event)"
    />
    <div v-if="actions" class="demo-comment-compose-footer">
      <span class="demo-scene-meta">分享你的想法</span>
      <NovaButton type="submit" variant="primary" :busy="busy">发布</NovaButton>
    </div>
  </form>
</template>
