<template>
  <div class="page">
    <div class="page-head">
      <h1 class="page-title">个人中心</h1>
      <p class="page-subtitle">维护账号资料与登录密码。</p>
    </div>

    <div class="profile-grid">
      <aside class="surface-card profile-card">
        <div class="avatar-wrap">
          <a-avatar :src="avatarPreview" :size="88" class="avatar">
            {{ userStore.displayName.charAt(0) }}
          </a-avatar>
          <a-upload
            :show-upload-list="false"
            accept="image/png,image/jpeg,image/webp,image/gif"
            :before-upload="handleAvatarUpload"
          >
            <a-button size="small" :loading="avatarUploading" class="avatar-btn">
              <template #icon>
                <CameraOutlined />
              </template>
              更换头像
            </a-button>
          </a-upload>
        </div>

        <div class="profile-name">{{ userStore.displayName }}</div>
        <div class="profile-account text-muted">@{{ userStore.userInfo?.userAccount || '-' }}</div>
        <div class="profile-role">
          <a-tag :color="userRoleMeta(userStore.userInfo?.userRole).color">
            {{ userRoleMeta(userStore.userInfo?.userRole).label }}
          </a-tag>
        </div>

        <!-- 不展示用户 ID 等内部字段：对使用者没有意义 -->
        <a-descriptions :column="1" size="small" bordered class="profile-desc">
          <a-descriptions-item label="最近编辑">{{ formatTime(userStore.userInfo?.editTime) }}</a-descriptions-item>
        </a-descriptions>

        <a-button block class="logout-btn" @click="handleLogout">退出登录</a-button>
      </aside>

      <div class="right-col">
        <!-- 编辑资料 -->
        <section class="surface-card edit-card">
          <div class="card-head">
            <h2 class="card-title">编辑资料</h2>
            <span class="card-desc">昵称、头像与简介，保存后立即生效。</span>
          </div>

          <a-form layout="vertical" :model="form" class="edit-form">
            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="账号">
                  <a-input :value="form.userAccount" disabled />
                  <div class="field-hint">账号与角色不可自行修改。</div>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="用户昵称">
                  <a-input
                    v-model:value="form.userName"
                    placeholder="展示昵称，不能为空白"
                    :maxlength="32"
                    allow-clear
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item label="头像">
              <div class="avatar-field">
                <div class="avatar-preview">
                  <img v-if="avatarPreview" :src="avatarPreview" alt="头像预览" />
                  <div v-else class="avatar-empty">未设置</div>
                </div>
                <div class="avatar-meta">
                  <div class="avatar-state">
                    <a-tag v-if="pendingAvatar" color="blue">新头像待保存</a-tag>
                    <span v-else class="text-tertiary">当前头像已生效</span>
                  </div>
                  <div class="field-hint">
                    点击左侧「更换头像」上传，保存后由后端迁移到你的头像目录。
                  </div>
                  <div v-if="pendingAvatar" class="field-hint mono">临时路径：{{ pendingAvatar }}</div>
                </div>
              </div>
            </a-form-item>

            <a-form-item label="用户简介">
              <a-textarea
                v-model:value="form.userProfile"
                :rows="3"
                :maxlength="200"
                show-count
                placeholder="一句话介绍自己，留空表示清空"
              />
            </a-form-item>

            <a-space>
              <a-button type="primary" :loading="submitting" @click="handleSaveInfo">保存资料</a-button>
              <a-button :disabled="submitting" @click="resetForm">还原</a-button>
            </a-space>
          </a-form>
        </section>

        <!-- 修改密码 -->
        <section class="surface-card pwd-card">
          <div class="card-head">
            <h2 class="card-title">修改密码</h2>
            <span class="card-desc">需要验证当前密码，修改后其他设备的登录态会失效。</span>
          </div>

          <a-form layout="vertical" :model="pwdForm" class="pwd-form" @submit.prevent="handleChangePassword">
            <a-row :gutter="16">
              <a-col :span="8">
                <a-form-item label="当前密码">
                  <a-input-password
                    v-model:value="pwdForm.oldPassword"
                    placeholder="请输入当前密码"
                    autocomplete="current-password"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="新密码">
                  <a-input-password
                    v-model:value="pwdForm.newPassword"
                    placeholder="至少 6 位"
                    autocomplete="new-password"
                  />
                </a-form-item>
              </a-col>
              <a-col :span="8">
                <a-form-item label="确认新密码">
                  <a-input-password
                    v-model:value="pwdForm.confirmPassword"
                    placeholder="再次输入新密码"
                    autocomplete="new-password"
                    @press-enter="handleChangePassword"
                  />
                </a-form-item>
              </a-col>
            </a-row>

            <a-space>
              <a-button type="primary" :loading="pwdSubmitting" @click="handleChangePassword">
                确认修改
              </a-button>
              <a-button :disabled="pwdSubmitting" @click="resetPasswordForm">清空</a-button>
            </a-space>
          </a-form>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { CameraOutlined } from '@ant-design/icons-vue'
import { getUserById, updateMyInfo, updatePassword } from '@/api/user'
import { uploadPicture } from '@/api/picture'
import { formatTime, userRoleMeta } from '@/utils/format'
import { resolveImageUrl } from '@/utils/image'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const submitting = ref(false)
const pwdSubmitting = ref(false)
const avatarUploading = ref(false)

/**
 * 后端 updateMyInfo 校验：userAvatar 必须位于当前用户的 temp 目录（temp/image/{userId}/...），
 * 保存时服务端才把它复制到 avatar/image/{userId}/ 正式目录。
 * 因此只有在本次会话新上传时才提交该字段，未换头像时不传（null 表示不更新），
 * 否则把已生效的 avatar/image/... 地址回传会被判为「头像地址非法」。
 */
const pendingAvatar = ref('')

const form = reactive({
  userAccount: '',
  userName: '',
  userProfile: ''
})

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const avatarPreview = computed(() =>
  resolveImageUrl(pendingAvatar.value || userStore.avatarUrl)
)

function fillForm() {
  const info = userStore.userInfo || {}
  form.userAccount = info.userAccount || ''
  form.userName = info.userName || ''
  form.userProfile = info.userProfile || ''
  pendingAvatar.value = ''
}

// 个人中心展示更完整的资料（getById 返回 UserVO）
async function loadProfile() {
  if (!userStore.userId) return
  try {
    const detail = await getUserById(userStore.userId)
    if (detail) {
      userStore.userInfo = { ...userStore.userInfo, ...detail }
    }
  } catch (e) {
    /* 失败时沿用登录态信息 */
  }
}

watch(
  () => [userStore.userInfo?.userName, userStore.userInfo?.userProfile, userStore.userInfo?.userAvatar],
  () => {
    // 首次与切换用户时同步表单；保存成功后由 fillForm 显式重置
    if (!submitting.value) fillForm()
  },
  { immediate: true }
)

async function handleAvatarUpload(file) {
  avatarUploading.value = true
  try {
    const vo = await uploadPicture(formDataOf(file))
    const key = vo?.url || ''
    const expected = `temp/image/${userStore.userId}/`
    if (!key.startsWith(expected)) {
      message.error('头像上传返回路径异常，请重试')
      return false
    }
    pendingAvatar.value = key
    message.success('头像已上传，保存后生效')
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    avatarUploading.value = false
  }
  // 阻止 a-upload 自带的上传行为
  return false
}

function formDataOf(file) {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

async function handleSaveInfo() {
  const userName = form.userName ?? ''
  if (!userName.trim()) {
    message.warning('昵称不能为空')
    return
  }
  submitting.value = true
  try {
    const payload = {
      userName: userName.trim(),
      userProfile: form.userProfile ?? ''
    }
    if (pendingAvatar.value) payload.userAvatar = pendingAvatar.value
    await updateMyInfo(payload)
    message.success('资料已更新')
    await userStore.fetchUserInfo(true)
    await loadProfile()
    fillForm()
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  fillForm()
}

async function handleChangePassword() {
  const { oldPassword, newPassword, confirmPassword } = pwdForm
  if (!oldPassword || !newPassword || !confirmPassword) {
    message.warning('请填写完整的密码信息')
    return
  }
  if (newPassword !== confirmPassword) {
    message.warning('两次输入的新密码不一致')
    return
  }
  if (newPassword === oldPassword) {
    message.warning('新密码不能与旧密码相同')
    return
  }
  if (newPassword.length < 6) {
    message.warning('新密码至少 6 位')
    return
  }
  pwdSubmitting.value = true
  try {
    await updatePassword({ oldPassword, newPassword, confirmPassword })
    message.success('密码已修改，其他设备的登录态已失效')
    resetPasswordForm()
  } catch (e) {
    /* 拦截器已提示（旧密码错误等） */
  } finally {
    pwdSubmitting.value = false
  }
}

function resetPasswordForm() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
}

async function handleLogout() {
  await userStore.logout()
  router.push('/login')
}

onMounted(async () => {
  if (!userStore.userInfo) {
    await userStore.fetchUserInfo(true)
  }
  await loadProfile()
})
</script>

<style scoped lang="less">
.profile-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.8fr) minmax(0, 1.4fr);
  gap: 20px;
  align-items: start;
}

.right-col {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.profile-card {
  padding: 26px 22px;
  text-align: center;
}

.avatar-wrap {
  display: grid;
  justify-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.avatar {
  background: linear-gradient(135deg, #6366f1, #7c3aed);
  color: #fff;
  font-weight: 650;
  font-size: 32px;
}

.avatar-btn {
  border-radius: 999px;
}

.profile-name {
  font-size: 18px;
  font-weight: 650;
}

.profile-account {
  margin-top: 4px;
  font-size: 13px;
}

.profile-role {
  margin: 12px 0 18px;
}

.profile-desc {
  text-align: left;
  font-size: 13px;
}

.logout-btn {
  margin-top: 18px;
}

.edit-card,
.pwd-card {
  padding: 24px;
}

.card-head {
  margin-bottom: 18px;
}

.card-title {
  margin: 0;
  font-size: 17px;
  font-weight: 620;
}

.card-desc {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.edit-form,
.pwd-form {
  max-width: 720px;
}

.field-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-tertiary);
}

.field-hint.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  word-break: break-all;
}

.avatar-field {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.avatar-preview {
  width: 72px;
  height: 72px;
  flex: none;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg);
  display: grid;
  place-items: center;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-empty {
  font-size: 12px;
  color: var(--text-tertiary);
}

.avatar-meta {
  min-width: 0;
}

.avatar-state {
  margin-bottom: 2px;
}

@media (max-width: 980px) {
  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
