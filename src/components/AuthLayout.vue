<template>
  <div class="auth-layout">
    <aside class="brand">
      <div class="glow glow-a" />
      <div class="glow glow-b" />
      <div class="glow glow-c" />

      <div class="brand-body">
        <div class="brand-logo">
          <span class="mark">
            <PictureOutlined />
          </span>
          <span class="name">图库 · PictureHub</span>
        </div>

        <h1 class="brand-title">{{ title }}</h1>
        <p class="brand-desc">{{ description }}</p>

        <ul class="brand-features">
          <li v-for="item in features" :key="item">
            <span class="dot" />
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>

      <div class="brand-foot">© {{ year }} PictureHub · 图片资产管理平台</div>
    </aside>

    <section class="panel">
      <div class="panel-card">
        <slot />
      </div>
    </section>
  </div>
</template>

<script setup>
import { PictureOutlined } from '@ant-design/icons-vue'

defineProps({
  title: { type: String, default: '发现与收藏每一张好图' },
  description: {
    type: String,
    default: '一个支持上传、检索与团队协作管理的图片资产平台。'
  },
  features: {
    type: Array,
    default: () => [
      '本地文件 / 网络 URL / 批量抓取，多种方式入库',
      '按名称、分类、标签、格式、主色调组合筛选',
      '公共图库审核流与私有空间分级管理',
      '我的上传与私有空间，沉淀个人图片资产'
    ]
  }
})

const year = new Date().getFullYear()
</script>

<style scoped lang="less">
.auth-layout {
  min-height: 100vh;
  display: flex;
}

.brand {
  position: relative;
  flex: 1.1;
  overflow: hidden;
  padding: 56px 56px 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #fff;
  background: linear-gradient(150deg, #4f46e5 0%, #5b53f0 45%, #7c3aed 100%);
}

.glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(6px);
  pointer-events: none;
}

.glow-a {
  width: 420px;
  height: 420px;
  top: -140px;
  right: -120px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.22), transparent 65%);
}

.glow-b {
  width: 320px;
  height: 320px;
  bottom: -100px;
  left: -80px;
  background: radial-gradient(circle, rgba(129, 140, 248, 0.5), transparent 65%);
}

.glow-c {
  width: 180px;
  height: 180px;
  bottom: 120px;
  right: 80px;
  background: radial-gradient(circle, rgba(236, 233, 254, 0.28), transparent 65%);
}

.brand-body {
  position: relative;
  z-index: 1;
  max-width: 460px;
}

.brand-logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 48px;
}

.mark {
  width: 36px;
  height: 36px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  font-size: 18px;
  background: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.28);
}

.name {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.brand-title {
  margin: 0;
  font-size: 34px;
  line-height: 1.3;
  font-weight: 650;
  letter-spacing: -0.6px;
}

.brand-desc {
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.78);
}

.brand-features {
  margin: 40px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.brand-features li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.88);
}

.dot {
  margin-top: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.85);
}

.brand-foot {
  position: relative;
  z-index: 1;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}

.panel {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 40px 24px;
  background: var(--bg);
}

.panel-card {
  width: 100%;
  max-width: 400px;
}

@media (max-width: 960px) {
  .brand {
    display: none;
  }
}
</style>
