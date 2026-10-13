<template>
  <div class="notfound">
    <div class="code">404</div>
    <h1 class="title">页面走丢了</h1>
    <p class="desc">你访问的地址不存在，或者已经被移除了。</p>
    <a-space>
      <a-button type="primary" @click="router.push('/')">回到图库首页</a-button>
      <a-button @click="goBack">返回上一页</a-button>
    </a-space>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'

const router = useRouter()

// 没有站内来路时（直接打开错误链接）回退会离开站点，此时回首页
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>

<style scoped lang="less">
.notfound {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 24px;
  text-align: center;
}

.code {
  font-size: 76px;
  font-weight: 700;
  letter-spacing: -2px;
  background: linear-gradient(100deg, #312e81 0%, #4f46e5 55%, #7c3aed 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.title {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 620;
}

.desc {
  margin: 0 0 20px;
  color: var(--text-secondary);
}
</style>
