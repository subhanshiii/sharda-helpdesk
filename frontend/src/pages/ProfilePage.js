import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import API from '../utils/api';
import toast from 'react-hot-toast';
import { PageHeader, Alert, Avatar } from '../components/ui';
import { getAvatarPresetUrl, getRoleColor, formatDate } from '../utils/helpers';
import { FiUser, FiMail, FiBook, FiHash, FiLock, FiCheck, FiUpload, FiImage } from 'react-icons/fi';
import { AVATAR_OPTIONS } from '../constants/avatarOptions';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();

  const [profileForm, setProfileForm] = useState({
    name:         user?.name || '',
    department:   user?.department || '',
    enrollmentId: user?.enrollmentId || '',
  });
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword:     '',
    confirmPassword: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [passLoading,    setPassLoading]    = useState(false);
  const [profileError,   setProfileError]   = useState('');
  const [passError,      setPassError]      = useState('');
  const [avatarLoading,  setAvatarLoading]  = useState(false);
  const [avatarExpanded, setAvatarExpanded] = useState(false);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim()) { setProfileError('Name is required'); return; }
    setProfileLoading(true);
    try {
      const res = await API.put('/auth/updateprofile', profileForm);
      updateUser(res.data.data);
      toast.success('Profile updated');
      setProfileError('');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Update failed');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleAvatarChoice = async (avatarChoice) => {
    setAvatarLoading(true);
    try {
      const res = await API.put('/auth/updateprofile', { avatarChoice, removeProfileImage: true });
      updateUser(res.data.data);
      toast.success('Avatar updated');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('profileImage', file);
    setAvatarLoading(true);
    try {
      const res = await API.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(res.data.data);
      toast.success('Profile image updated');
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to upload image');
    } finally {
      setAvatarLoading(false);
      event.target.value = '';
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passForm.newPassword !== passForm.confirmPassword) {
      setPassError('New passwords do not match');
      return;
    }
    if (passForm.newPassword.length < 6) {
      setPassError('Password must be at least 6 characters');
      return;
    }
    setPassLoading(true);
    try {
      await API.put('/auth/changepassword', {
        currentPassword: passForm.currentPassword,
        newPassword:     passForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPassError('');
    } catch (err) {
      setPassError(err.response?.data?.message || 'Password change failed');
    } finally {
      setPassLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="My Profile" subtitle="Manage your account details" />

      {/* Profile card */}
      <div className="card p-6">
        {/* Avatar + role banner */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <Avatar user={user} size="xl" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`badge ${getRoleColor(user?.role)}`}>{user?.role}</span>
              {user?.department && (
                <span className="badge bg-gray-100 text-gray-600">{user?.department}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4">
          <button
            type="button"
            onClick={() => setAvatarExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left transition hover:border-gray-200 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <FiImage size={15} className="text-gray-500" />
              <div>
                <div className="text-sm font-semibold text-gray-900">Profile picture & avatar</div>
                <p className="mt-0.5 text-sm text-gray-500">Click to {avatarExpanded ? 'hide' : 'manage'} uploaded and preset avatars.</p>
              </div>
            </div>
            <span className="text-sm font-semibold text-blue-600">{avatarExpanded ? 'Hide' : 'Manage'}</span>
          </button>

          {avatarExpanded ? (
            <>
              <p className="mt-4 text-sm text-gray-500">Priority order: uploaded image, selected avatar, then generated initials.</p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-blue-200 hover:bg-blue-50">
                <FiUpload size={14} />
                {avatarLoading ? 'Uploading...' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarLoading} />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {AVATAR_OPTIONS.map((avatarChoice) => (
                  <button
                    key={avatarChoice}
                    type="button"
                    disabled={avatarLoading}
                    onClick={() => handleAvatarChoice(avatarChoice)}
                    className={`rounded-2xl border p-3 transition ${user?.avatarChoice === avatarChoice ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
                      <img src={getAvatarPresetUrl(avatarChoice)} alt="Preset avatar" className="h-full w-full rounded-full object-contain" />
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-gray-400">Icons made by Freepik from www.flaticon.com</p>
            </>
          ) : null}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Member since</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5">{formatDate(user?.createdAt)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500">Enrollment ID</p>
            <p className="text-sm font-semibold text-gray-800 mt-0.5 font-mono">
              {user?.enrollmentId || '—'}
            </p>
          </div>
        </div>

        {/* Edit profile form */}
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Edit Profile</h3>
        {profileError && <div className="mb-3"><Alert type="error" message={profileError} /></div>}
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                className="input pl-9"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>
          </div>

          <div>
            <label className="label">Email <span className="text-gray-400 font-normal text-xs">(cannot be changed)</span></label>
            <div className="relative">
              <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input className="input pl-9 bg-gray-50 text-gray-400" value={user?.email} disabled />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Department</label>
              <div className="relative">
                <FiBook className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  className="input pl-9"
                  value={profileForm.department}
                  onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="e.g. CSE"
                />
              </div>
            </div>
            <div>
              <label className="label">Enrollment ID</label>
              <div className="relative">
                <FiHash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  className="input pl-9"
                  value={profileForm.enrollmentId}
                  onChange={e => setProfileForm(f => ({ ...f, enrollmentId: e.target.value }))}
                  placeholder="SU2024001"
                />
              </div>
            </div>
          </div>

          <button type="submit" disabled={profileLoading} className="btn-primary">
            <FiCheck size={14} />
            {profileLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* Change password card */}
      <div className="card p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <FiLock size={15} /> Change Password
        </h3>
        {passError && <div className="mb-3"><Alert type="error" message={passError} /></div>}
        <form onSubmit={handlePasswordChange} className="space-y-4">
          {[
            { name: 'currentPassword', label: 'Current Password', placeholder: 'Enter current password' },
            { name: 'newPassword',     label: 'New Password',     placeholder: 'Minimum 6 characters'    },
            { name: 'confirmPassword', label: 'Confirm New Password', placeholder: 'Re-enter new password' },
          ].map(field => (
            <div key={field.name}>
              <label className="label">{field.label}</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input
                  type="password"
                  className="input pl-9"
                  value={passForm[field.name]}
                  onChange={e => setPassForm(f => ({ ...f, [field.name]: e.target.value }))}
                  placeholder={field.placeholder}
                />
              </div>
            </div>
          ))}
          <button type="submit" disabled={passLoading} className="btn-primary">
            <FiLock size={14} />
            {passLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
