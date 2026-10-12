<template>
  <AuthLayout title="欢迎回来" description="登录后即可上传图片、管理私有空间并参与公共图库共建。">
    <div class="auth-head">
      <h2>登录账号</h2>
      <p>
        还没有账号？
        <router-link to="/register" class="link">立即注册</router-link>
      </p>
    </div>

    <a-form
      ref="formRef"
      :model="form"
      :rules="rules"
      layout="vertical"
      size="large"
      @finish="handleSubmit"
    >
      <a-form-item name="userAccount">
        <a-input
          v-model:value="form.userAccount"
          placeholder="请输入账号"
          allow-clear
          autocomplete="username"
        >
          <template #prefix>
            <UserOutlined class="field-icon" />
          </template>
        </a-input>
      </a-form-item>

      <a-form-item name="userPassword">
        <a-input-password
          v-model:value="form.userPassword"
          placeholder="请输入密码"
          allow-clear
          autocomplete="current-password"
          @press-enter="handleSubmit"
        >
          <template #prefix>
            <LockOutlined class="field-icon" />
          </template>
        </a-input-password>
      </a-form-item>

      <a-button type="primary" html-type="submit" block :loading="loading" class="submit-btn">
        登录
      </a-button>
    </a-form>
  </AuthLayout>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LockOutlined, UserOutlined } from '@ant-design/icons-vue'
import AuthLayout from '@/components/AuthLayout.vue'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)

const form = reactive({
  userAccount: '',
  userPassword: ''
})

const rules = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 2, max: 32, message: '账号长度需在 2 ~ 32 个字符之间', trigger: 'blur' }
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ]
}

async function handleSubmit() {
  loading.value = true
  try {
    await userStore.login({ ...form })
    message.success('登录成功')
    const redirect = route.query.redirect
    router.replace(typeof redirect === 'string' && redirect ? redirect : '/')
  } catch (e) {
    /* 错误提示由请求拦截器统一处理 */
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="less">
.auth-head {
  margin-bottom: 28px;
}

.auth-head h2 {
  margin: 0;
  font-size: 25px;
  font-weight: 650;
  letter-spacing: -0.3px;
}

.auth-head p {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.link {
  color: var(--brand);
  font-weight: 500;
}

.field-icon {
  color: var(--text-tertiary);
}

.submit-btn {
  margin-top: 8px;
  font-weight: 600;
}
</style>
