# Alpha Tester Agreement — PostCrisp / Crusher Brands, LLC

> **⚠️ Not legal advice.** This template was drafted for informal pre-launch
> alpha testing among friends and early supporters. Run it past an attorney
> before using it with anyone you don't personally know, before scaling past
> ~10 testers, or before you have paying customers. Keep it simple until it
> can't be simple anymore.

---

## How to use this

1. **Before sharing the invite code** to a new alpha tester, send them a
   copy of the agreement below (email attachment, DocuSign, HelloSign —
   any of these work).
2. **Capture their consent** — either a countersigned PDF or an email
   reply that says `I agree to the Alpha Tester Agreement — [Full Name]`.
   Email replies count as electronic signatures under the US E-SIGN Act.
3. **Save the acceptance** — keep the email thread / signed PDF in a
   dedicated folder (e.g. `/alpha-ndas/` on your drive). Never rely on
   memory for who agreed to what.
4. **Then and only then** send them:
   - Production URL: `https://postcrisp.vercel.app` (or the custom domain)
   - Invite code (current code lives at `/admin/access-control`)
   - Instructions to use the in-app 💬 Feedback button
5. **After they sign up**, bump their tier in `/admin/users/[their-id]`
   to Creator or Elite so they can try every feature.

---

## Before using, fill in these blanks

- `[YOUR STATE]` — Crusher Brands, LLC's state of registration (used for governing law clause). **Currently blank — fill in before sending.**
- `[YOUR FULL NAME]` — the name you sign as.
- `[EFFECTIVE DATE]` — date of sending.
- `[TESTER NAME]` — the person you're sending it to.

---

## Template

```
ALPHA TESTER AGREEMENT

This Agreement is made between Crusher Brands, LLC ("Company")
and [TESTER NAME] ("Tester"), effective [EFFECTIVE DATE].


1. THE PRODUCT

Tester is receiving early access to PostCrisp, an AI content platform
still in pre-release alpha ("the Product"). The Product, including
all features, UI/UX designs, business logic, pricing strategies,
roadmap, bugs, technical implementation, and internal communications
related to it ("Confidential Information"), is confidential property
of Company.


2. TESTER OBLIGATIONS

Tester agrees to:

  (a) Keep all Confidential Information strictly private. Not share
      screenshots, descriptions, features, or any details publicly
      (social media, blog posts, podcasts, videos, group chats, etc.)
      without prior WRITTEN consent from Crusher Brands, LLC.

  (b) Not use Confidential Information to build, launch, or assist
      any competing product or service.

  (c) Not reverse-engineer, copy, or attempt to derive source code
      or algorithms from the Product.

  (d) Report bugs, feedback, and observations privately to Company
      through the in-app feedback channel — never through public
      support forums, social media, or third parties.

  (e) Maintain confidentiality for two (2) years from the date a
      given feature becomes public, or indefinitely for features
      that remain non-public.


3. EXCEPTIONS

Nothing in this Agreement prohibits Tester from disclosing information
that is (a) already publicly available through no fault of Tester,
(b) independently developed without reference to the Product, or
(c) required to be disclosed by law, provided Company is given prompt
written notice so it may seek a protective order.


4. FEEDBACK OWNERSHIP

Any feedback, ideas, suggestions, or bug reports Tester provides may
be used by Company without restriction, attribution, or compensation.
Tester retains no ownership interest in such feedback and assigns any
rights in it to Company.


5. NO WARRANTY

The Product is provided "as is" and "as available." Company makes no
guarantees about stability, data retention, feature availability, or
continued access during the alpha period.


6. NO EMPLOYMENT / EQUITY / COMPENSATION

This Agreement does not create any employment, partnership, agency,
or equity relationship between Tester and Company. Tester is a
volunteer alpha tester and will not receive monetary compensation
for participation.


7. TERM AND TERMINATION

Either party may end Tester's alpha access at any time, for any
reason, with or without notice. Confidentiality obligations under
Section 2 survive any termination of this Agreement per the term
specified in Section 2(e).


8. GOVERNING LAW

This Agreement is governed by the laws of the State of [YOUR STATE],
without regard to its conflict-of-laws rules. Any disputes arising
under this Agreement will be resolved exclusively in the state or
federal courts located in [YOUR STATE].


9. ENTIRE AGREEMENT

This Agreement is the entire agreement between the parties regarding
its subject matter and supersedes all prior discussions or
understandings.


By signing below, Tester acknowledges having read, understood, and
agreed to all terms of this Alpha Tester Agreement.


_____________________________________     ______________
Tester (signature / typed name)            Date


_____________________________________     ______________
[YOUR FULL NAME], on behalf of             Date
Crusher Brands, LLC
```

---

## Suggested accompanying email

```
Subject: PostCrisp alpha — want in?

Hey [NAME],

I've been building that AI content platform I mentioned —
PostCrisp. It's live in invite-only alpha and I'd love for you
to kick the tires, specifically because [reason they're a great fit].

Quick thing first: attaching a simple one-page alpha tester
agreement. Standard NDA stuff — just says you'll keep features
private while we're still in alpha and won't use my ideas to
start a competing product. Not expecting that from you at all,
it's just what I do for every tester now. Reply with "I agree to
the Alpha Tester Agreement — [Your Full Name]" and we're good.

Once you're signed in:
- Invite code: [CURRENT INVITE CODE]
- URL: https://postcrisp.vercel.app
- I'll bump your account to Creator tier so you can try every feature
- Use the 💬 Feedback button on any page — bugs, ideas, confusion,
  all of it helps

Really appreciate this. Let me know when you've had a chance to
play and I'll jump on a call to hear what you think.

— [Your name]
```

---

## Future-us checklist

When this template stops being enough:

- [ ] Consult an attorney when onboarding > 10 testers or when opening to public alpha
- [ ] Separate **Terms of Service** (for all users) from **Alpha NDA** (for testers specifically)
- [ ] Move acceptance into the product (onboarding checkbox + acceptance timestamp in DB)
- [ ] Add a **Privacy Policy** before any paid users — required by Stripe, Apple, Google, most EU law
- [ ] Register Crusher Brands, LLC's DBA as PostCrisp if you haven't already
