
const EXTRACT_TOKEN_REGEX = /PLX-[A-Z0-9]{5}/i;
const EXTRACT_AMOUNT_REGEX = /(?:(?:Montant|Amount)[:\s]*\$?\s*|Virement Interac de\s*|[:\s]\$)(\d+[\s,.]\d{2})|(\d+[\s,.]\d{2})\s*\$/i;

interface TestCase {
  name: string;
  bankSource: string;
  rawPayload: string;
  expectedToken: string;
  expectedAmount: number;
}

const testCases: TestCase[] = [
  {
    name: "Desjardins French Standard Notification",
    bankSource: "Desjardins",
    rawPayload: `
      De : virement@desjardins.com
      Date : 24 mai 2026 12:14 EDT
      Objet : Un virement Interac de Brandon Lacoste vous a été envoyé.
      
      Bonjour Planxo Inc,
      Brandon Lacoste vous a envoyé un virement Interac de 172,46 $.
      
      Message de l'expéditeur :
      PLX-X7R2B
      
      Pour déposer les fonds, veuillez cliquer sur le lien sécurisé fourni par votre institution.
    `,
    expectedToken: "PLX-X7R2B",
    expectedAmount: 172.46
  },
  {
    name: "RBC English Messy Layout with HTML spaces",
    bankSource: "RBC Royal Bank",
    rawPayload: `
      Notification: Interac e-Transfer Received
      Amount: $ 57.49 CAD
      Sender Message: &nbsp;&nbsp;plx-k9a3m&nbsp;&nbsp;
      Ref Number: INTERAC-E89237492
      Please auto-deposit or click below.
    `,
    expectedToken: "PLX-K9A3M",
    expectedAmount: 57.49
  },
  {
    name: "National Bank French Multi-Line Break Block",
    bankSource: "Banque Nationale",
    rawPayload: `
      Virement Interac reçu de la part de : Consultation Clinique
      Montant : 229,95 $ (CAD)
      Message :
      -------------------------------------
      PLX-M2W9V
      -------------------------------------
      ID de transaction : NBF892374
    `,
    expectedToken: "PLX-M2W9V",
    expectedAmount: 229.95
  }
];

function runRedTeamSuite() {
  console.log("====================================================");
  console.log("🚀 STARTING INTERAC PARSER RED-TEAM STRESS TESTS");
  console.log("====================================================\n");

  let passedTests = 0;

  testCases.forEach((tc, index) => {
    console.log(`📌 Test #${index + 1}: [${tc.bankSource}] ${tc.name}`);
    
    const tokenMatch = tc.rawPayload.match(EXTRACT_TOKEN_REGEX);
    const extractedToken = tokenMatch ? tokenMatch[0].toUpperCase() : "NOT_FOUND";
    
    const amountMatch = tc.rawPayload.match(EXTRACT_AMOUNT_REGEX);
    let extractedAmount = 0;

    if (amountMatch) {
      const rawNumStr = (amountMatch[1] || amountMatch[2])
        .replace(/\s/g, "")
        .replace(/,/g, ".");
      extractedAmount = parseFloat(rawNumStr);
    }

    const tokenPassed = extractedToken === tc.expectedToken;
    const amountPassed = Math.abs(extractedAmount - tc.expectedAmount) < 0.01;

    if (tokenPassed && amountPassed) {
      console.log("  ✅ PASSED");
      passedTests++;
    } else {
      console.log("  ❌ FAILED DETECTED");
      console.log(`     -> Expected Token: ${tc.expectedToken} | Extracted: ${extractedToken}`);
      console.log(`     -> Expected Amount: ${tc.expectedAmount} | Extracted: ${extractedAmount}`);
    }
    console.log("----------------------------------------------------");
  });

  console.log(`\n🏆 FINAL SCORE: ${passedTests} / ${testCases.length} TESTS PASSED`);
  if (passedTests === testCases.length) {
    console.log("🛡️ VERDICT: Parser is bulletproof. Ready for production ingestion routing.");
  } else {
    console.log("⚠️ VERDICT: Edge case failure detected. Refine regex bounds before shipping.");
  }
}

runRedTeamSuite();
