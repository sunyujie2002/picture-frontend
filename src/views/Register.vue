<template>
  <AuthLayout title="创建你的账号" description="注册后即可上传图片、建立私有空间，并把优质素材分享到公共图库。">
    <div class="auth-head">
      <h2>注册新账号</h2>
      <p>
        已有账号？
        <router-link to="/login" class="link">直接登录</router-link>
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
      <a-form-item name="userAccount" label="账号">
        <a-input v-model:value="form.userAccount" placeholder="4 ~ 32 位，支持字母、数字、下划线" allow-clear>
          <template #prefix>
            <UserOutlined class="field-icon" />
          </template>
        </a-input>
      </a-form-item>

      <a-form-item name="userPassword" label="密码">
        <a-input-password v-model:value="form.userPassword" placeholder="至少 6 位" allow-clear>
          <template #prefix>
            <LockOutlined class="field-icon" />
          </template>
        </a-input-password>
        <div class="strength">
          <span
            v-for="i in 3"
            :key="i"
            class="bar"
            :class="{ active: strength >= i }"
            :style="{ background: strength >= i ? strengthColor : undefined }"
          />
          <span class="strength-text">{{ strengthText }}</span>
        </div>
      </a-form-item>

      <a-form-item name="confirmPassword" label="确认密码">
        <a-input-password
          v-model:value="form.confirmPassword"
          placeholder="请再次输入密码"
          allow-clear
          @press-enter="handleSubmit"
        >
          <template #prefix>
            <SafetyOutlined class="field-icon" />
          </template>
        </a-input-password>
      </a-form-item>

      <a-button type="primary" html-type="submit" block :loading="loading" class="submit-btn">
        注册
      </a-button>
    </a-form>
  </AuthLayout>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LockOutlined, SafetyOutlined, UserOutlined } from '@ant-design/icons-vue'
import AuthLayout from '@/components/AuthLayout.vue'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref()
const loading = ref(false)

const form = reactive({
  userAccount: '',
  userPassword: '',
  confirmPassword: ''
})

const strength = computed(() => {
  const pwd = form.userPassword || ''
  if (!pwd) return 0
  let score = 0
  if (pwd.length >= 6) score += 1
  if (pwd.length >= 10) score += 1
  if (/[A-Za-z]/.test(pwd) && /\d/.test(pwd)) score += 1
  return Math.min(score, 3)
})

const strengthText = computed(() => ['', '弱', '中等', '强'][strength.value])
const strengthColor = computed(() => ['', '#ef4444', '#f59e0b', '#16a34a'][strength.value])

const rules = {
  userAccount: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { min: 4, max: 32, message: '账号长度需在 4 ~ 32 个字符之间', trigger: 'blur' },
    { pattern: /^[A-Za-z0-9_]+$/, message: '账号只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  userPassword: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value) => {
        if (!value) return Promise.resolve()
        if (value !== form.userPassword) return Promise.reject(new Error('两次输入的密码不一致'))
        return Promise.resolve()
      },
      trigger: 'blur'
    }
  ]
}

async function handleSubmit() {
  loading.value = true
  try {
    await userStore.register({ ...form })
    message.success('注册成功，请登录')
    router.replace({ name: 'login', query: { userAccount: form.userAccount } })
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

.strength {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.bar {
  width: 34px;
  height: 4px;
  border-radius: 999px;
  background: #e8eaf0;
  transition: background 0.2s ease;
}

.strength-text {
  margin-left: 4px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.submit-btn {
  height: 42px;
  margin-top: 4px;
  font-weight: 500;
}
</style>
