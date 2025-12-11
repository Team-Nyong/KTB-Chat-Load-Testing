import React, { useState, useRef, useEffect } from 'react';
import axiosInstance from '../services/axios.js';
import { CameraIcon, CloseOutlineIcon } from '@vapor-ui/icons';
import { Button, Text, Callout, VStack, HStack } from '@vapor-ui/core';
import { useAuth } from '@/contexts/AuthContext';
import CustomAvatar from '@/components/CustomAvatar';
import { Toast } from '@/components/Toast';
import fileService from '../services/fileService';

const ProfileImageUpload = ({ currentImage, onImageChange }) => {
  const { user } = useAuth();
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // 프로필 이미지 URL 생성
  const getProfileImageUrl = (imagePath) => {
    if (!imagePath) return null;
    return imagePath.startsWith('http') ? 
      imagePath : 
      `${process.env.NEXT_PUBLIC_API_URL}${imagePath}`;
  };

  // 컴포넌트 마운트 시 이미지 설정
  useEffect(() => {
    const imageUrl = getProfileImageUrl(currentImage);
    setPreviewUrl(imageUrl);
  }, [currentImage]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let tempPreviewUrl;

    try {
      const validation = await fileService.validateFile(file);
      if (!validation.success) {
        throw new Error(validation.message);
      }

      setUploading(true);
      setError('');

      // 파일 미리보기 생성
      tempPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(tempPreviewUrl);

      // 인증 정보 확인
      if (!user?.token || !user?.sessionId) {
        throw new Error('인증 정보가 없습니다.');
      }

      console.debug('[ProfileImageUpload] Start upload', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const uploadResult = await fileService.uploadFile(
        file,
        null,
        user.token,
        user.sessionId,
        'profile'
      );

      console.debug('[ProfileImageUpload] S3 upload result', uploadResult);

      if (!uploadResult.success || !uploadResult.data?.file?.url) {
        throw new Error(uploadResult.message || '이미지 업로드에 실패했습니다.');
      }

      const uploadUrl = uploadResult.data.file.url;

      // 사용자 프로필에 이미지 URL 저장
      const profileSaveUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/users/profile-image`;
      console.debug('[ProfileImageUpload] Save profile image', {
        profileSaveUrl,
        uploadUrl
      });

      const profileResponse = await axiosInstance.post(
        profileSaveUrl,
        {
          url: uploadUrl,
          mimetype: file.type,
          size: file.size
        },
        { withCredentials: true }
      );

      if (!profileResponse?.data?.success) {
        throw new Error(profileResponse?.data?.message || '프로필 이미지 저장에 실패했습니다.');
      }

      const finalUrl = profileResponse.data.imageUrl || uploadUrl;

      if (tempPreviewUrl && tempPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(tempPreviewUrl);
      }

      setPreviewUrl(finalUrl);
      onImageChange(finalUrl);
      Toast.success('프로필 이미지가 변경되었습니다.');

      // 전역 이벤트 발생
      window.dispatchEvent(new Event('userProfileUpdate'));

    } catch (error) {
      console.error('Image upload error:', error);
      setError(error.message);
      setPreviewUrl(getProfileImageUrl(currentImage));
    } finally {
      if (tempPreviewUrl && tempPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(tempPreviewUrl);
      }
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    try {
      setUploading(true);
      setError('');

      // 인증 정보 확인
      if (!user?.token) {
        throw new Error('인증 정보가 없습니다.');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/profile-image`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': user?.token,
          'x-session-id': user?.sessionId
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '이미지 삭제에 실패했습니다.');
      }

      // 로컬 스토리지의 사용자 정보 업데이트
      const updatedUser = {
        ...user,
        profileImage: ''
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));

      // 기존 objectUrl 정리
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }

      setPreviewUrl(null);
      onImageChange('');

      // 전역 이벤트 발생
      window.dispatchEvent(new Event('userProfileUpdate'));

    } catch (error) {
      console.error('Image removal error:', error);
      setError(error.message);
    } finally {
      setUploading(false);
    }
  };

  // 컴포넌트 언마운트 시 cleanup
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <VStack gap="$300" alignItems="center">
      <CustomAvatar
        user={user}
        size="xl"
        persistent={true}
        showInitials={true}
        data-testid="profile-image-avatar"
      />
      
      <HStack gap="$200" justifyContent="center">
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          data-testid="profile-image-upload-button"
        >
          <CameraIcon />
          이미지 변경
        </Button>

        {previewUrl && (
          <Button
            type="button"
            variant="fill"
            colorPalette="danger"
            onClick={handleRemoveImage}
            disabled={uploading}
            data-testid="profile-image-delete-button"
          >
            <CloseOutlineIcon />
            이미지 삭제
          </Button>
        )}
      </HStack>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={handleFileSelect}
        data-testid="profile-image-file-input"
      />

      {error && (
        <Callout color="danger">
          <HStack gap="$200" alignItems="center">
            <Text>{error}</Text>
          </HStack>
        </Callout>
      )}

      {uploading && (
        <Text typography="body3" color="$hint-100">
          이미지 업로드 중...
        </Text>
      )}
    </VStack>
  );
};

export default ProfileImageUpload;
