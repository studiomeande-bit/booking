/* Studio mean — 철회 안내 정본 (예약 화면 4/4 단계 · /widerruf/ 페이지 공용, 빌드 없이 <script> 로 싣는다).
 * 독일어 = Anlage 1·2 EGBGB 공식 서식 원문(빈칸만 채움, 2026-09-18 대조). 다듬지 말 것.
 * 아래 리터럴은 appscript/Code.gs 의 WIDERRUF_TEXT_ 와 한 글자도 다르면 안 된다 → node scripts/check-widerruf.mjs
 * 계획·결정: docs/widerruf-function-plan.md */
window.SM_WIDERRUF_TEXT = /* WIDERRUF_TEXT:BEGIN */
{
  "version": "WB-2026-09",
  "url": "https://booking.studio-mean.com/widerruf/",
  "de": {
    "intro": "Verbraucherinnen und Verbrauchern (§ 13 BGB) steht ein Widerrufsrecht nach Maßgabe der folgenden Widerrufsbelehrung zu.",
    "title": "Widerrufsbelehrung",
    "sections": [
      {
        "h": "Widerrufsrecht",
        "ps": [
          "Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.",
          "Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
          "Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, Telefon: +49 176 6093 9400, E-Mail: studio.mean.de@gmail.com) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.",
          "Sie können Ihr Widerrufsrecht auch online unter https://booking.studio-mean.com/widerruf/ ausüben. Wenn Sie diese Online-Funktion nutzen, übermitteln wir Ihnen auf einem dauerhaften Datenträger (z. B. durch eine E-Mail) unverzüglich eine Eingangsbestätigung mit Informationen zum Inhalt der Widerrufserklärung sowie dem Datum und der Uhrzeit ihres Eingangs.",
          "Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden."
        ]
      },
      {
        "h": "Folgen des Widerrufs",
        "ps": [
          "Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass Sie eine andere Art der Lieferung als die von uns angebotene, günstigste Standardlieferung gewählt haben), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.",
          "Haben Sie verlangt, dass die Dienstleistungen während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht."
        ]
      }
    ],
    "noteTitle": "Vorzeitiges Erlöschen des Widerrufsrechts",
    "note": "Ihr Widerrufsrecht erlischt vorzeitig mit der vollständigen Erbringung der Dienstleistung, wenn Sie vor Beginn der Erbringung ausdrücklich zugestimmt haben, dass wir mit der Erbringung der Dienstleistung vor Ablauf der Widerrufsfrist beginnen, und Ihre Kenntnis davon bestätigt haben, dass Ihr Widerrufsrecht mit vollständiger Vertragserfüllung durch uns erlischt.",
    "formTitle": "Muster-Widerrufsformular",
    "formNote": "(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)",
    "form": [
      "– An Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, studio.mean.de@gmail.com:",
      "– Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*)/die Erbringung der folgenden Dienstleistung (*)",
      "– Bestellt am (*)/erhalten am (*)",
      "– Name des/der Verbraucher(s)",
      "– Anschrift des/der Verbraucher(s)",
      "– Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)",
      "– Datum",
      "(*) Unzutreffendes streichen."
    ],
    "earlyStart": "Ich verlange ausdrücklich, dass Studio mean vor Ablauf der Widerrufsfrist mit der Ausführung der gebuchten Leistung (dem Shooting) beginnt. Mir ist bekannt, dass ich bei einem Widerruf einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlen muss und dass mein Widerrufsrecht mit vollständiger Vertragserfüllung durch Studio mean erlischt.",
    "passNote": "Die Terminreservierung für Pass- und Visafotos ist unverbindlich und kostenfrei. Der Vertrag über die Aufnahmen kommt erst vor Ort im Studio zustande; bis dahin entstehen Ihnen keine Kosten, auch wenn Sie den Termin nicht wahrnehmen. Bitte sagen Sie den Termin ab, wenn Sie nicht kommen können.",
    "stornoNote": "Das gesetzliche Widerrufsrecht für Verbraucherinnen und Verbraucher (siehe Widerrufsbelehrung) bleibt unberührt und geht dieser Staffel innerhalb der Widerrufsfrist vor.",
    "statement": "Hiermit widerrufe ich den von mir abgeschlossenen Vertrag.",
    "withdrawLabel": "Vertrag widerrufen",
    "confirmLabel": "Widerruf bestätigen"
  },
  "ko": {
    "intro": "소비자(독일 민법 제13조)에게는 아래 철회 안내에 따른 철회권이 있습니다.",
    "title": "철회 안내",
    "bindingNote": "참고 번역입니다. 법적 효력은 아래 독일어 원문(Widerrufsbelehrung)에 있습니다.",
    "sections": [
      {
        "h": "철회권",
        "ps": [
          "귀하는 이유를 밝히지 않고 14일 이내에 이 계약을 철회할 권리가 있습니다.",
          "철회기간은 계약 체결일로부터 14일입니다.",
          "철회권을 행사하려면 계약을 철회하겠다는 결정을 명확한 의사표시(예: 우편으로 보낸 편지 또는 이메일)로 저희(Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, 전화 +49 176 6093 9400, 이메일 studio.mean.de@gmail.com)에게 알려 주셔야 합니다. 함께 드리는 철회 서식을 쓰실 수 있지만 의무는 아닙니다.",
          "https://booking.studio-mean.com/widerruf/ 에서 온라인으로도 철회하실 수 있습니다. 이 온라인 기능을 이용하시면 철회 내용과 접수 날짜·시각이 담긴 수신 확인을 지체 없이 영구 보관이 가능한 매체(예: 이메일)로 보내 드립니다.",
          "철회기간을 지키려면 기간이 끝나기 전에 철회 통지를 보내시는 것으로 충분합니다."
        ]
      },
      {
        "h": "철회의 효과",
        "ps": [
          "이 계약을 철회하시면 저희는 귀하에게서 받은 모든 대금을 배송비를 포함하여(저희가 제공하는 가장 저렴한 기본 배송 대신 다른 배송 방식을 고르셔서 생긴 추가 비용은 제외) 철회 통지가 저희에게 도착한 날부터 지체 없이, 늦어도 14일 안에 돌려드립니다. 반환은 처음 결제하실 때와 같은 결제수단으로 하며, 따로 명시적으로 합의한 경우는 예외입니다. 반환 때문에 귀하에게 수수료가 부과되는 일은 없습니다.",
          "철회기간 중에 서비스를 시작해 달라고 요청하셨다면, 철회를 알려 주신 시점까지 이미 제공된 서비스가 계약상 전체 서비스에서 차지하는 비율만큼 적정한 금액을 저희에게 지불하셔야 합니다."
        ]
      }
    ],
    "noteTitle": "철회권의 조기 소멸",
    "note": "서비스가 시작되기 전에, 철회기간이 끝나기 전에 서비스를 시작하는 데 명시적으로 동의하고 계약이 완전히 이행되면 철회권이 소멸한다는 점을 확인하셨다면, 서비스가 완전히 제공되는 때 철회권은 기간보다 먼저 소멸합니다.",
    "formTitle": "철회 서식 (Muster-Widerrufsformular)",
    "formNote": "(계약을 철회하시려면 이 서식을 작성해 보내 주세요. 법정 서식이라 독일어 원문 그대로 싣습니다.)",
    "earlyStart": "철회기간(14일)이 끝나기 전에 Studio mean 이 예약한 서비스(촬영)를 시작해 줄 것을 명시적으로 요청합니다. 철회하면 그때까지 제공된 서비스에 대한 적정 금액을 지불해야 하고, Studio mean 이 계약을 완전히 이행하면 철회권이 소멸한다는 점을 알고 있습니다.",
    "passNote": "여권·비자 사진 예약은 무료이며 구속력이 없습니다. 촬영 계약은 스튜디오 현장에서 성립하며, 그 전까지는 예약 시간에 오지 못하셔도 비용이 생기지 않습니다. 오지 못하시게 되면 예약을 취소해 주세요.",
    "stornoNote": "소비자의 법정 철회권(철회 안내 참조)은 이 규정과 관계없이 보장되며, 철회기간 안에는 이 환불 규정보다 우선합니다.",
    "statement": "본인이 체결한 계약을 철회합니다.",
    "withdrawLabel": "계약 철회 · Vertrag widerrufen",
    "confirmLabel": "철회 확정 · Widerruf bestätigen"
  },
  "en": {
    "intro": "Consumers (Section 13 German Civil Code, BGB) have a right of withdrawal in accordance with the following instructions.",
    "title": "Withdrawal instructions",
    "bindingNote": "Courtesy translation. The German original (Widerrufsbelehrung) below is legally binding.",
    "sections": [
      {
        "h": "Right of withdrawal",
        "ps": [
          "You have the right to withdraw from this contract within 14 days without giving any reason.",
          "The withdrawal period will expire after 14 days from the day of the conclusion of the contract.",
          "To exercise the right of withdrawal, you must inform us (Studio mean, Inhaber Taewoong Min, Holzweg-Passage 3, 61440 Oberursel, Germany, phone +49 176 6093 9400, email studio.mean.de@gmail.com) of your decision to withdraw from this contract by an unequivocal statement (e.g. a letter sent by post or an email). You may use the attached model withdrawal form, but it is not obligatory.",
          "You can also exercise your right of withdrawal online at https://booking.studio-mean.com/widerruf/. If you use this online function, we will send you an acknowledgement of receipt on a durable medium (e.g. by email) without delay, containing the content of your withdrawal statement and the date and time of its receipt.",
          "To meet the withdrawal deadline, it is sufficient for you to send your communication concerning your exercise of the right of withdrawal before the withdrawal period has expired."
        ]
      },
      {
        "h": "Effects of withdrawal",
        "ps": [
          "If you withdraw from this contract, we shall reimburse to you all payments received from you, including the costs of delivery (with the exception of the supplementary costs resulting from your choice of a type of delivery other than the least expensive type of standard delivery offered by us), without undue delay and in any event not later than 14 days from the day on which we are informed about your decision to withdraw from this contract. We will carry out such reimbursement using the same means of payment as you used for the initial transaction, unless you have expressly agreed otherwise; in any event, you will not incur any fees as a result of such reimbursement.",
          "If you requested to begin the performance of services during the withdrawal period, you shall pay us an amount which is in proportion to what has been provided until you have communicated us your withdrawal from this contract, in comparison with the full coverage of the contract."
        ]
      }
    ],
    "noteTitle": "Early expiry of the right of withdrawal",
    "note": "Your right of withdrawal expires early upon complete performance of the service if, before performance began, you expressly consented to us beginning the service before the end of the withdrawal period and acknowledged that your right of withdrawal expires once we have fully performed the contract.",
    "formTitle": "Model withdrawal form (Muster-Widerrufsformular)",
    "formNote": "(Complete and return this form only if you wish to withdraw from the contract. It is a statutory form and is reproduced in the German original.)",
    "earlyStart": "I expressly request that Studio mean begin the booked service (the shoot) before the withdrawal period ends. I understand that if I withdraw, I must pay a reasonable amount for the services provided up to that point, and that my right of withdrawal expires once Studio mean has fully performed the contract.",
    "passNote": "Reservations for passport and visa photos are free and non-binding. The contract for the photos is only concluded on site at the studio; until then no costs arise, even if you do not attend. Please cancel your reservation if you cannot come.",
    "stornoNote": "Consumers' statutory right of withdrawal (see the withdrawal instructions) remains unaffected and takes precedence over this schedule during the withdrawal period.",
    "statement": "I hereby withdraw from the contract I concluded.",
    "withdrawLabel": "Withdraw from contract · Vertrag widerrufen",
    "confirmLabel": "Confirm withdrawal · Widerruf bestätigen"
  }
}/* WIDERRUF_TEXT:END */;
