
package com.ktb.chatapp.service;

import com.ktb.chatapp.dto.S3FileResponse;
import com.ktb.chatapp.dto.S3UploadRequest;
import com.ktb.chatapp.model.File;
import com.ktb.chatapp.repository.FileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Paths;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class S3FileService implements FileService {

    private final FileRepository fileRepository;

    @Override
    public FileUploadResult saveS3Metadata(S3UploadRequest request, String uploaderId) {
        try {
            String fullUrl = request.getUrl();

            String key = extractKeyFromUrl(fullUrl);


            String filename = extractFilenameFromUrl(fullUrl);

            File fileEntity = File.builder()
                    .filename(key)
                    .originalname(filename)
                    .mimetype(request.getMimetype())
                    .size(request.getSize())
                    .path(fullUrl)
                    .user(uploaderId)
                    .uploadDate(LocalDateTime.now())
                    .build();

            File savedFile = fileRepository.save(fileEntity);

            return FileUploadResult.builder()
                    .success(true)
                    .file(savedFile)
                    .build();

        } catch (Exception e) {
            log.error("DB 저장 실패", e);
            throw new RuntimeException("파일 메타데이터 저장 실패: " + e.getMessage());
        }
    }

    @Override
    public S3FileResponse getFile(String fileId) {
        File fileEntity = fileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("파일을 찾을 수 없습니다. id: " + fileId));

        return S3FileResponse.builder()
                .id(fileEntity.getId())
                .url(fileEntity.getPath())
                .originalFilename(fileEntity.getOriginalname())
                .mimetype(fileEntity.getMimetype())
                .size(fileEntity.getSize())
                .build();
    }


    private String extractKeyFromUrl(String url) {
        try {

            int index = url.indexOf(".amazonaws.com/");
            if (index != -1) {
                return url.substring(index + 15);
            }

            URI uri = new URI(url);
            String path = uri.getPath();
            return path.startsWith("/") ? path.substring(1) : path;
        } catch (URISyntaxException e) {

            return url;
        }
    }

    private String extractFilenameFromUrl(String url) {
        try {

            String path = new URI(url).getPath();
            return Paths.get(path).getFileName().toString();
        } catch (Exception e) {
            return "unknown_file";
        }
    }
}