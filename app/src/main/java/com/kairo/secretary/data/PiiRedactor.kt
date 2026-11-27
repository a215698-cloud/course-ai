package com.kairo.secretary.data

object PiiRedactor {
    private val myKadRegex = Regex("""\b\d{6}-\d{2}-\d{4}\b""")
    private val cnIdRegex = Regex("""\b[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b""")
    private val otpRegex = Regex("""((?:OTP|TAC|code|验证码|校验码|kod)\s*[:：#]?\s*)\d{4,8}""", RegexOption.IGNORE_CASE)
    private val phoneRegex = Regex("""(?:\+?\d{1,3}[\s-]?)?(?:0?1\d[\s-]?\d{3,4}[\s-]?\d{4}|1[3-9]\d{9})""")
    private val accountRegex = Regex("""\b(?:\d[ -]*?){12,19}\b""")

    fun redact(input: String): String {
        var out = input
        out = myKadRegex.replace(out, "[REDACTED_IC]")
        out = cnIdRegex.replace(out, "[REDACTED_ID]")
        out = otpRegex.replace(out) { "${it.groupValues[1]}[REDACTED_OTP]" }
        out = phoneRegex.replace(out, "[REDACTED_PHONE]")
        out = accountRegex.replace(out, "[REDACTED_ACCOUNT]")
        return out
    }
}
