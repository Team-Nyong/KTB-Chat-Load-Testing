package com.ktb.chatapp.service;

import com.ktb.chatapp.dto.S3FileResponse;
import com.ktb.chatapp.dto.S3UploadRequest;
import org.springframework.web.multipart.MultipartFile;

public interface FileService {

    FileUploadResult saveS3Metadata(S3UploadRequest request, String uploaderId);

    S3FileResponse getFile(String fileId);
}