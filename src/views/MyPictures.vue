<template>
  <div class="page">
    <div class="page-head head-row">
      <div>
        <h1 class="page-title">图片管理</h1>
        <p class="page-subtitle">
          管理我上传到公共图库的图片：编辑信息、调整分类与标签，或删除图片。通过审核后会展示在首页图库。
        </p>
      </div>
      <a-space>
        <a-button @click="router.push('/space')">
          <template #icon>
            <LockOutlined />
          </template>
          我的空间
        </a-button>
        <a-button type="primary" @click="router.push('/upload')">
          <template #icon>
            <CloudUploadOutlined />
          </template>
          上传图片
        </a-button>
      </a-space>
    </div>

    <div class="status-legend">
      <span class="legend-label">审核状态</span>
      <a-tag v-for="item in REVIEW_STATUS_OPTIONS" :key="item.value" :color="item.color">
        {{ item.label }}
      </a-tag>
      <span class="legend-tip">上传后为「待审核」，管理员通过后才会出现在首页图库。</span>
    </div>

    <PictureManageList
      :fetcher="queryPublicPictureList"
      show-review
      default-view="table"
      empty-title="还没有上传过图片"
    >
      <template #empty-action>
        <a-button type="primary" @click="router.push('/upload')">去上传</a-button>
      </template>
    </PictureManageList>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { CloudUploadOutlined, LockOutlined } from '@ant-design/icons-vue'
import PictureManageList from '@/components/PictureManageList.vue'
import { queryPublicPictureList } from '@/api/picture'
import { REVIEW_STATUS_OPTIONS } from '@/constants'

const router = useRouter()
</script>

<style scoped lang="less">
.head-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.status-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  font-size: 13px;
}

.legend-label {
  font-weight: 550;
  color: var(--text-secondary);
}

.legend-tip {
  color: var(--text-tertiary);
}
</style>
