<?php
declare(strict_types=1);

date_default_timezone_set('Europe/Berlin');

const STUDIO_CONTACT_EMAIL = 'studio.mean.de@gmail.com';
const STUDIO_SENDER_EMAIL = 'noreply@studio-mean.com';

function post_value(string $key): string
{
    return trim((string)($_POST[$key] ?? ''));
}

function single_line(string $value): string
{
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function clean_text(string $value): string
{
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    return trim($value);
}

function header_name(string $value): string
{
    return trim(str_replace(['<', '>', '"'], '', single_line($value)));
}

function encode_subject(string $value): string
{
    if (function_exists('mb_encode_mimeheader')) {
        return mb_encode_mimeheader($value, 'UTF-8');
    }

    return '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function redirect_for_language(string $language, string $state = 'success'): never
{
    $successPaths = [
        'en' => '/en/contact/success/',
        'ko' => '/ko/contact/success/',
        'de' => '/contact/success/',
    ];

    $errorPaths = [
        'en' => '/en/contact/?error=1',
        'ko' => '/ko/contact/?error=1',
        'de' => '/contact/?error=1',
    ];

    $paths = $state === 'success' ? $successPaths : $errorPaths;
    header('Location: ' . ($paths[$language] ?? $paths['de']), true, 303);
    exit;
}

function fail_page(string $language): never
{
    $mailto = 'mailto:' . STUDIO_CONTACT_EMAIL;
    $messages = [
        'de' => [
            'title' => 'Nachricht konnte nicht gesendet werden.',
            'body' => 'Bitte kontaktieren Sie Studio mean direkt per E-Mail.',
        ],
        'en' => [
            'title' => 'Message could not be sent.',
            'body' => 'Please contact Studio mean directly by e-mail.',
        ],
        'ko' => [
            'title' => '문의 전송에 실패했습니다.',
            'body' => '아래 이메일로 직접 연락해 주세요.',
        ],
    ];
    $copy = $messages[$language] ?? $messages['en'];
    http_response_code(500);
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!doctype html><html lang="en"><meta charset="utf-8">';
    echo '<meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>Studio mean contact</title>';
    echo '<body style="font-family:Arial,sans-serif;background:#0b0b0c;color:#f4f1ec;padding:32px;line-height:1.5">';
    echo '<h1>' . htmlspecialchars($copy['title'], ENT_QUOTES, 'UTF-8') . '</h1>';
    echo '<p>' . htmlspecialchars($copy['body'], ENT_QUOTES, 'UTF-8') . '</p>';
    echo '<p><a style="color:#f4f1ec" href="' . htmlspecialchars($mailto, ENT_QUOTES, 'UTF-8') . '">' . STUDIO_CONTACT_EMAIL . '</a></p>';
    echo '</body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Location: /contact/', true, 303);
    exit;
}

$language = post_value('site_language');
if (!in_array($language, ['de', 'en', 'ko'], true)) {
    $language = 'de';
}

if (post_value('bot-field') !== '') {
    redirect_for_language($language);
}

$name = single_line(post_value('name'));
$email = single_line(post_value('email'));
$phone = single_line(post_value('phone'));
$projectType = single_line(post_value('project_type'));
$preferredDate = single_line(post_value('preferred_date'));
$location = single_line(post_value('location'));
$message = clean_text(post_value('message'));
$privacyConsent = post_value('privacy_consent');

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || $projectType === '' || $message === '' || $privacyConsent === '') {
    redirect_for_language($language, 'error');
}

$submittedAt = date('Y-m-d H:i:s T');
$remoteIp = single_line((string)($_SERVER['REMOTE_ADDR'] ?? ''));
$userAgent = single_line((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));

$subject = 'Studio mean portfolio inquiry - ' . $projectType . ' - ' . $name;
$encodedSubject = encode_subject($subject);

$body = implode("\n", [
    'New Studio mean portfolio inquiry',
    '',
    'Submitted: ' . $submittedAt,
    'Language: ' . $language,
    '',
    'Name: ' . $name,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : '-'),
    'Project type: ' . $projectType,
    'Preferred timing: ' . ($preferredDate !== '' ? $preferredDate : '-'),
    'Location: ' . ($location !== '' ? $location : '-'),
    '',
    'Message:',
    $message,
    '',
    'Privacy consent: yes',
    'IP: ' . ($remoteIp !== '' ? $remoteIp : '-'),
    'User agent: ' . ($userAgent !== '' ? $userAgent : '-'),
]);

$headers = [
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'From: Studio mean Website <' . STUDIO_SENDER_EMAIL . '>',
    'Reply-To: ' . header_name($name) . ' <' . $email . '>',
];

$sent = mail(STUDIO_CONTACT_EMAIL, $encodedSubject, $body, implode("\r\n", $headers));

if (!$sent) {
    fail_page($language);
}

redirect_for_language($language);
