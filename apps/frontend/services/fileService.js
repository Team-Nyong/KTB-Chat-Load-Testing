import axios, { isCancel, CancelToken } from 'axios';
import axiosInstance from './axios';
import { Toast } from '../components/Toast';

class FileService {
  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL;
    this.imageUrl = process.env.NEXT_PUBLIC_IMAGE_UPLOAD_URL
    this.uploadLimit = 50 * 1024 * 1024; // 50MB
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.activeUploads = new Map();

    this.allowedTypes = {
      image: {
        extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
        mimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        maxSize: 10 * 1024 * 1024,
        name: '이미지'
      },
      document: {
        extensions: ['.pdf'],
        mimeTypes: ['application/pdf'],
        maxSize: 20 * 1024 * 1024,
        name: 'PDF 문서'
      }
    };
  }

  async validateFile(file) {
    if (!file) {
      const message = '파일이 선택되지 않았습니다.';
      Toast.error(message);
      return { success: false, message };
    }

    if (file.size > this.uploadLimit) {
      const message = `파일 크기는 ${this.formatFileSize(this.uploadLimit)}를 초과할 수 없습니다.`;
      Toast.error(message);
      return { success: false, message };
    }

    let isAllowedType = false;
    let maxTypeSize = 0;
    let typeConfig = null;

    for (const config of Object.values(this.allowedTypes)) {
      if (config.mimeTypes.includes(file.type)) {
        isAllowedType = true;
        maxTypeSize = config.maxSize;
        typeConfig = config;
        break;
      }
    }

    if (!isAllowedType) {
      const message = '지원하지 않는 파일 형식입니다.';
      Toast.error(message);
      return { success: false, message };
    }

    if (file.size > maxTypeSize) {
      const message = `${typeConfig.name} 파일은 ${this.formatFileSize(maxTypeSize)}를 초과할 수 없습니다.`;
      Toast.error(message);
      return { success: false, message };
    }

    const ext = this.getFileExtension(file.name);
    if (!typeConfig.extensions.includes(ext.toLowerCase())) {
      const message = '파일 확장자가 올바르지 않습니다.';
      Toast.error(message);
      return { success: false, message };
    }

    return { success: true };
  }

  async uploadFile(file, onProgress, token, sessionId, name) {
    const validationResult = await this.validateFile(file);
    if (!validationResult.success) {
      return validationResult;
    }

    const objectKey = `upload/${name}/${file.name}`;

    // s3에 업로드
    try {
      const uploadUrl = `${this.imageUrl}/${objectKey}`;

      // 취소 토큰 관리
      const source = CancelToken.source();
      this.activeUploads.set(file.name, source);

      const s3Response = await axios.put(uploadUrl, file, {
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        withCredentials: false, 
        cancelToken: source.token,
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            onProgress(percentCompleted);
          }
        }
      })
      console.log("uploadurl: ", uploadUrl);

      this.activeUploads.delete(file.name);

      if (s3Response.status !== 200 && s3Response.status !== 201) {
        return {
          success: false,
          message: 'S3 업로드에 실패했습니다.'
        };
      }

      console.log("s3Response: ", s3Response);

      // 서버에 전달
      // token과 sessionId는 axios 인터셉터에서 자동으로 추가되므로
      // 여기서는 명시적으로 전달하지 않아도 됩니다
      const serverUrl = `${this.baseUrl}/api/files/upload`;
      console.log("serverurl: ", serverUrl);
      const serverResponse = await axiosInstance.post(serverUrl,
        {
          url: uploadUrl,
          mimetype: file.type,
          size: file.size,
        },
        {
          withCredentials: true,
        }
      );

      this.activeUploads.delete(file.name);

      if (!serverResponse.data || serverResponse.data.success === false) {
        return {
          success: false,
          message: serverResponse.data?.message || '파일 정보 저장에 실패했습니다.',
        };
      }

      const normalizedFile = this.normalizeFileResponse(serverResponse.data, {
        id: objectKey,
        url: uploadUrl,
        originalFilename: file.name,
        mimetype: file.type,
        size: file.size
      });

      if (!normalizedFile?.url) {
        return {
          success: false,
          message: '업로드된 파일 정보를 불러올 수 없습니다.',
        };
      }

      return {
        success: true,
        data: {
          file: normalizedFile,
          objectKey,
          s3Url: normalizedFile.url,
        },
      };
    } catch (error) {
      this.activeUploads.delete(file.name);

      if (isCancel(error)) {
        return {
          success: false,
          message: '업로드가 취소되었습니다.'
        };
      }

      if (error.response?.status === 401) {
        throw new Error('Authentication expired. Please login again.');
      }

      return this.handleUploadError(error);
    }
  }

  async downloadFile(filename, originalname, token, sessionId) {
  try {
    // 파일 존재 여부 먼저 확인
    const downloadUrl = this.getFileUrl(filename, false);
    // axios 인터셉터가 자동으로 인증 헤더를 추가합니다
    const checkResponse = await axiosInstance.head(downloadUrl, {
      validateStatus: status => status < 500,
      withCredentials: true
    });

    if (checkResponse.status === 404) {
      return {
        success: false,
        message: '파일을 찾을 수 없습니다.'
      };
    }

    if (checkResponse.status === 403) {
      return {
        success: false,
        message: '파일에 접근할 권한이 없습니다.'
      };
    }

    if (checkResponse.status !== 200) {
      return {
        success: false,
        message: '파일 다운로드 준비 중 오류가 발생했습니다.'
      };
    }

    // axios 인터셉터가 자동으로 인증 헤더를 추가합니다
    const response = await axiosInstance({
      method: 'GET',
      url: downloadUrl,
      responseType: 'blob',
      timeout: 30000,
      withCredentials: true
    });

    const contentType = response.headers['content-type'];
    const contentDisposition = response.headers['content-disposition'];
    let finalFilename = originalname;

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(
        /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/
      );
      if (filenameMatch) {
        finalFilename = decodeURIComponent(
          filenameMatch[1] || filenameMatch[2] || filenameMatch[3]
        );
      }
    }

    const blob = new Blob([response.data], {
      type: contentType || 'application/octet-stream'
    });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = finalFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 100);

    return { success: true };

  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Authentication expired. Please login again.');
    }

    return this.handleDownloadError(error);
  }
}

getFileUrl(filename, forPreview = false) {
  if (!filename) return '';

  const imageUrl = process.env.NEXT_PUBLIC_IMAGE_UPLOAD_URL || '';
  const endpoint = forPreview ? 'view' : 'download';
  return `${imageUrl}/${endpoint}/${filename}`;
}

getPreviewUrl(file) {
  if (!file) return '';
  if (file.url) return file.url;
  if (file.s3Url) return file.s3Url;
  if (file.filename) return this.getFileUrl(file.filename, true);
  return '';
}

getFileType(filename) {
  if (!filename) return 'unknown';
  const ext = this.getFileExtension(filename).toLowerCase();
  for (const [type, config] of Object.entries(this.allowedTypes)) {
    if (config.extensions.includes(ext)) {
      return type;
    }
  }
  return 'unknown';
}

getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
}

formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${units[i]}`;
}

getHeaders(token, sessionId) {
  if (!token || !sessionId) {
    return {
      'Accept': 'application/json, */*'
    };
  }
  return {
    'x-auth-token': token,
    'x-session-id': sessionId,
    'Accept': 'application/json, */*'
  };
}

handleUploadError(error) {
  console.error('Upload error:', error);

  if (error.code === 'ECONNABORTED') {
    return {
      success: false,
      message: '파일 업로드 시간이 초과되었습니다.'
    };
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    switch (status) {
      case 400:
        return {
          success: false,
          message: message || '잘못된 요청입니다.'
        };
      case 401:
        return {
          success: false,
          message: '인증이 필요합니다.'
        };
      case 413:
        return {
          success: false,
          message: '파일이 너무 큽니다.'
        };
      case 415:
        return {
          success: false,
          message: '지원하지 않는 파일 형식입니다.'
        };
      case 500:
        return {
          success: false,
          message: '서버 오류가 발생했습니다.'
        };
      default:
        return {
          success: false,
          message: message || '파일 업로드에 실패했습니다.'
        };
    }
  }

  return {
    success: false,
    message: error.message || '알 수 없는 오류가 발생했습니다.',
    error
  };
}

handleDownloadError(error) {
  console.error('Download error:', error);

  if (error.code === 'ECONNABORTED') {
    return {
      success: false,
      message: '파일 다운로드 시간이 초과되었습니다.'
    };
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    switch (status) {
      case 404:
        return {
          success: false,
          message: '파일을 찾을 수 없습니다.'
        };
      case 403:
        return {
          success: false,
          message: '파일에 접근할 권한이 없습니다.'
        };
      case 400:
        return {
          success: false,
          message: message || '잘못된 요청입니다.'
        };
      case 500:
        return {
          success: false,
          message: '서버 오류가 발생했습니다.'
        };
      default:
        return {
          success: false,
          message: message || '파일 다운로드에 실패했습니다.'
        };
    }
  }

  return {
    success: false,
    message: error.message || '알 수 없는 오류가 발생했습니다.',
    error
  };
}

cancelUpload(filename) {
  const source = this.activeUploads.get(filename);
  if (source) {
    source.cancel('Upload canceled by user');
    this.activeUploads.delete(filename);
    return {
      success: true,
      message: '업로드가 취소되었습니다.'
    };
  }
  return {
    success: false,
    message: '취소할 업로드를 찾을 수 없습니다.'
  };
}

cancelAllUploads() {
  let canceledCount = 0;
  for (const [filename, source] of this.activeUploads) {
    source.cancel('All uploads canceled');
    this.activeUploads.delete(filename);
    canceledCount++;
  }

  return {
    success: true,
    message: `${canceledCount}개의 업로드가 취소되었습니다.`,
    canceledCount
  };
}

getErrorMessage(status) {
  switch (status) {
    case 400:
      return '잘못된 요청입니다.';
    case 401:
      return '인증이 필요합니다.';
    case 403:
      return '파일에 접근할 권한이 없습니다.';
    case 404:
      return '파일을 찾을 수 없습니다.';
    case 413:
      return '파일이 너무 큽니다.';
    case 415:
      return '지원하지 않는 파일 형식입니다.';
    case 500:
      return '서버 오류가 발생했습니다.';
    case 503:
      return '서비스를 일시적으로 사용할 수 없습니다.';
    default:
      return '알 수 없는 오류가 발생했습니다.';
  }
}

isRetryableError(error) {
  if (!error.response) {
    return true; // 네트워크 오류는 재시도 가능
  }

  const status = error.response.status;
  return [408, 429, 500, 502, 503, 504].includes(status);
}

normalizeFileResponse(responseData, fallback = {}) {
  if (!responseData) return null;

  const file = responseData.file || responseData.data || responseData;
  if (!file) return null;

  const fileId = file.id || file._id || file.fileId || file.filename || fallback.id;
  return {
    id: fileId,
    _id: fileId,
    url: file.url || file.s3Url || file.fileUrl || file.location || fallback.url,
    filename: file.filename || fallback.filename,
    originalFilename: file.originalFilename || file.originalname || file.fileName || file.filename || fallback.originalFilename,
    originalname: file.originalFilename || file.originalname || file.fileName || file.filename || fallback.originalFilename,
    mimetype: file.mimetype || file.mimeType || file.contentType || fallback.mimetype,
    size: file.size || file.fileSize || file.length || fallback.size
  };
}
}

export default new FileService();
