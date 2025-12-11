package com.ktb.chatapp.controller;

import com.ktb.chatapp.dto.S3FileResponse;
import com.ktb.chatapp.dto.S3UploadRequest;
import com.ktb.chatapp.model.User;
import com.ktb.chatapp.repository.UserRepository;
import com.ktb.chatapp.service.FileService;
import com.ktb.chatapp.service.FileUploadResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@Tag(name = "파일 (Files)", description = "파일 메타데이터 관리 API")
@Slf4j
@RequiredArgsConstructor
@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;
    private final UserRepository userRepository;

    @Operation(summary = "S3 업로드 완료 및 메타데이터 저장", description = "프론트엔드 S3 업로드 후 파일 정보(크기, 타입 등)를 DB에 저장합니다.")
    @PostMapping("/upload")
    public ResponseEntity<?> completeS3Upload(
            @RequestBody S3UploadRequest requestDto,
            Principal principal) {
        try {
            User user = userRepository.findByEmail(principal.getName())
                    .orElseThrow(() -> new UsernameNotFoundException("User not found: " + principal.getName()));

            FileUploadResult result = fileService.saveS3Metadata(requestDto, user.getId());

            if (result.isSuccess()) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("message", "파일 저장 성공");
                response.put("file", result.getFile());
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(500).body("DB 저장 실패");
            }

        } catch (Exception e) {
            log.error("메타데이터 저장 중 에러 발생", e);
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "저장 중 오류 발생");
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(500).body(errorResponse);
        }
    }

    @Operation(summary = "파일 정보 조회", description = "파일 ID로 메타데이터와 접근 URL을 조회합니다.")
    @GetMapping("/{fileId}")
    public ResponseEntity<?> getFileMetadata(@PathVariable String fileId) {
        try {
            S3FileResponse response = fileService.getFile(fileId);

            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("file", response);

            return ResponseEntity.ok(result);

        } catch (RuntimeException e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("success", false);
            errorResponse.put("message", "파일을 찾을 수 없습니다.");
            return ResponseEntity.status(404).body(errorResponse);
        }
    }
}