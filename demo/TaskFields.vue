<script setup lang="ts">
import { NovaField } from '../src'
import { useId } from 'vue'

type TaskFields = { note?: string; due?: string; priority?: string }
defineProps<{ task: TaskFields }>()
const emit = defineEmits<{ change: [fields: TaskFields] }>()
const priorityId = useId()
</script>

<template>
  <div class="demo-task-detail-fields">
    <NovaField
      :model-value="task.note || ''"
      label="任务备注"
      as="textarea"
      :rows="4"
      :maxlength="200"
      placeholder="记下要做的事或需要准备的东西…"
      @update:model-value="emit('change', { note: $event })"
    />
    <NovaField
      :model-value="task.due || ''"
      label="计划日期"
      type="date"
      @update:model-value="emit('change', { due: $event })"
    />
    <div class="demo-native-field">
      <label :for="priorityId">优先级</label>
      <select
        :id="priorityId"
        :value="task.priority || 'normal'"
        @change="emit('change', { priority: ($event.target as HTMLSelectElement).value })"
      >
        <option value="normal">普通</option>
        <option value="high">优先处理</option>
        <option value="low">稍后安排</option>
      </select>
    </div>
  </div>
</template>
