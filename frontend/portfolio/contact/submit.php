<?php
declare(strict_types=1);

date_default_timezone_set('Europe/Berlin');

const STUDIO_CONTACT_EMAIL = 'studio.mean.de@gmail.com';
const STUDIO_SENDER_EMAIL = 'noreply@studio-mean.com';

/* ERP 연결 (2026-08-26)
 * 이 폼은 그동안 mail() 한 통만 보내고 ERP 에는 아무 기록도 남기지 않았다. 그래서
 *   · 문의가 리드 장부에 안 쌓이고(브리핑·어드민에서 안 보임)
 *   · 고객은 접수 확인 메일을 못 받고
 *   · 사장님은 SEO 스팸과 구분 안 되는 평범한 메일 한 통만 받아 실제 문의가 묻혔다
 *     (2026-08-26 점검: 김정음 웨딩·이홍규 프로필·왕혜연 가족사진 3건 미회신 확인).
 * GAS 쪽엔 이미 `portfolio-lead` 공개 라우트가 있고 리드 장부 기록 + 사장님 알림 +
 * 고객 접수확인 메일까지 전부 구현돼 있었다 — 부르지 않았을 뿐이다. 인증키가 필요 없는
 * 공개 라우트라 이 파일에 비밀값을 두지 않는다.
 * 호출이 실패하면 기존 mail() 로 폴백하므로 문의가 유실되지는 않는다. */
const STUDIO_ERP_BASE = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec';
const STUDIO_ERP_ENDPOINT = STUDIO_ERP_BASE . '?api=portfolio-lead';
/* 웨딩·기업·영상처럼 상담이 필요한 문의는 상담 시트로 보낸다 (2026-08-26 페이지 통합).
   짧은 문의는 그대로 리드 시트 — ERP 의 통합 뷰(inquiry-list)가 둘을 한 목록으로 보여주므로
   사장님 입장에선 차이가 없고, 상담 쪽에만 있는 설문·회의록·예약전환 파이프라인은 살아 있다. */
const STUDIO_ERP_CONSULT_ENDPOINT = STUDIO_ERP_BASE . '?api=consultation';

/* 실제로 받은 SEO 영업 스팸의 발신 패턴. 사람이 쓴 문의를 막지 않도록 명백한 것만 좁게 넣는다.
 * 스팸은 조용히 성공 페이지로 보내되(봇에게 실패를 알리지 않는다) 메일도 ERP 기록도 만들지 않는다. */
function is_obvious_spam(string $email, string $name, string $message): bool
{
    $email = strtolower($email);
    $junkDomains = ['search-studio-mean.com', 'noreply-studio-mean.com', 'vseoarena'];
    foreach ($junkDomains as $needle) {
        if (str_contains($email, $needle)) {
            return true;
        }
    }
    // 본문에 링크만 잔뜩 있는 전형적인 SEO 스팸
    return substr_count(strtolower($message), 'http') >= 4;
}

/* GAS portfolio-lead 라우트 호출. 성공하면 배열, 실패하면 null.
 * GAS /exec 은 302 로 googleusercontent 를 가리키므로 FOLLOWLOCATION 이 필수다
 * (리다이렉트를 GET 으로 따라가야 JSON 본문이 온다). */
function forward_to_erp(array $lead, string $endpoint = STUDIO_ERP_ENDPOINT): ?array
{
    if (!function_exists('curl_init')) {
        return null;
    }
    $body = json_encode(['requestId' => $lead['requestId'], 'data' => $lead], JSON_UNESCAPED_UNICODE);
    if ($body === false) {
        return null;
    }
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($raw === false || $status < 200 || $status >= 300) {
        return null;
    }
    $parsed = json_decode((string)$raw, true);
    if (!is_array($parsed) || ($parsed['ok'] ?? false) !== true) {
        return null;
    }
    return $parsed['data'] ?? [];
}

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
            'title' => 'Die Anfrage konnte nicht gesendet werden.',
            'body' => 'Bitte senden Sie Ihre Anfrage direkt per E-Mail an Studio mean.',
        ],
        'en' => [
            'title' => 'Your inquiry could not be sent.',
            'body' => 'Please send your inquiry directly to Studio mean by e-mail.',
        ],
        'ko' => [
            'title' => '문의 전송에 실패했습니다.',
            'body' => '아래 이메일로 문의 내용을 직접 보내 주세요.',
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

/* 스팸은 조용히 흘려보낸다 — 봇에게 차단 사실을 알리지 않는다 */
if (is_obvious_spam($email, $name, $message)) {
    redirect_for_language($language);
}

/* 1순위: ERP 로 넘긴다. 성공하면 리드 장부 기록 + 사장님 알림 + 고객 접수확인 메일이
   모두 GAS 쪽에서 처리되므로 아래 mail() 은 건너뛴다(중복 알림 방지). */
/* 상담 문항이 하나라도 채워졌으면 '상담'으로 취급한다 — 폼에서 웨딩·기업·영상을 고른 경우에만
   그 칸들이 보이므로, 값이 있다는 건 상담이 필요한 유형이라는 뜻이다. */
$budget = single_line(post_value('budget'));
$scope = single_line(post_value('scope'));
$deliverables = single_line(post_value('deliverables'));
$company = single_line(post_value('company'));
$isConsultation = ($scope !== '' || $company !== '')
    || ($budget !== '' && !in_array($budget, ['미정', 'Not decided', 'Noch offen'], true))
    || ($deliverables !== '' && !in_array($deliverables, ['미정', 'Not decided', 'Noch offen'], true));

$erp = forward_to_erp([
    'requestId' => 'web-' . substr(hash('sha256', $email . '|' . $message . '|' . $submittedAt), 0, 32),
    'name' => $name,
    'email' => $email,
    'phone' => $phone,
    'projectType' => $projectType,
    'preferredDate' => $preferredDate,
    'location' => $location,
    'message' => $message,
    'lang' => $language,
    'privacyConsent' => true,
    'source' => 'studio-mean.com/contact',
    'sourceUrl' => 'https://studio-mean.com' . ($_SERVER['REQUEST_URI'] ?? '/contact/'),
    'ip' => $remoteIp,
    'userAgent' => $userAgent,
    // 상담 라우트가 쓰는 필드 — 리드 라우트는 모르는 키라 그냥 무시한다
    'consultationType' => $projectType,
    'typeLabel' => $projectType,
    'budget' => $budget,
    'company' => $company,
    'shootDate' => $preferredDate,
    'answers' => ['scope' => $scope, 'deliverables' => $deliverables],
], $isConsultation ? STUDIO_ERP_CONSULT_ENDPOINT : STUDIO_ERP_ENDPOINT);

if (is_array($erp)) {
    $successPath = is_string($erp['successPath'] ?? null) ? $erp['successPath'] : '';
    if ($successPath !== '' && str_starts_with($successPath, '/')) {
        header('Location: ' . $successPath, true, 303);
        exit;
    }
    redirect_for_language($language);
}

/* 폴백: ERP 가 응답하지 않으면 기존대로 메일이라도 보내 문의를 잃지 않는다 */
$sent = mail(STUDIO_CONTACT_EMAIL, $encodedSubject, $body, implode("\r\n", $headers));

if (!$sent) {
    fail_page($language);
}

redirect_for_language($language);
