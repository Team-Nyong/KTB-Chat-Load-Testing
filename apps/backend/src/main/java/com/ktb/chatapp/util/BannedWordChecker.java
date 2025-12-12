package com.ktb.chatapp.util;

import org.springframework.util.Assert;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public class BannedWordChecker {

    private final Pattern bannedWordPattern;

    public BannedWordChecker(Set<String> bannedWords) {
        Set<String> normalizedWords =
                bannedWords.stream()
                        .filter(word -> word != null && !word.isBlank())
                        .map(word -> word.toLowerCase(Locale.ROOT))
                        .collect(Collectors.toUnmodifiableSet());
        Assert.notEmpty(normalizedWords, "Banned words set must not be empty");

        String expression =
                normalizedWords.stream()
                        .map(Pattern::quote)
                        .collect(Collectors.joining("|"));
        this.bannedWordPattern = Pattern.compile(expression, Pattern.CASE_INSENSITIVE);
    }

    public boolean containsBannedWord(String message) {
        if (message == null || message.isBlank()) {
            return false;
        }

        return bannedWordPattern.matcher(message).find();
    }
}