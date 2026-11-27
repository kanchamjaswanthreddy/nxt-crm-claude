// NXT client education brochures. Written by NXT in plain language for clients; general education only.
// Each brochure: what it is, why it matters, how it works, what to weigh up, and questions to bring to the conversation.

export const EDUCATION_CATEGORIES = [
  { key: 'annuity', label: 'Annuities', blurb: 'Income you cannot outlive, and protection from market swings.' },
  { key: 'life', label: 'Life Insurance', blurb: 'Protection for the people who depend on you, and ways to use a policy while living.' },
  { key: 'disability', label: 'Disability Insurance', blurb: 'Protecting a paycheck, a retirement plan or a business if you cannot work.' },
];

export const BROCHURES = [
  // ───────────── Annuities ─────────────
  {
    slug: 'annuities-in-your-plan', category: 'annuity', photo: 'our-vision',
    title: 'Where an annuity fits in your plan',
    summary: 'What an annuity does that savings and investments alone do not.',
    intro: 'Most retirement plans are built from savings, investments and Social Security. An annuity adds something different: a contract with an insurance company that can protect part of your money and turn it into income you can count on.',
    sections: [
      { heading: 'What an annuity is', body: ['An annuity is an agreement between you and an insurer. You pay a premium, either all at once or over time. In return the insurer promises growth, income, or both, under terms written into the contract.'] },
      { heading: 'What it can add', bullets: ['Income that continues for as long as you live', 'Growth that is tax-deferred until you take money out', 'Protection of principal in fixed and fixed indexed designs', 'A way to pass remaining value to the people you name'] },
      { heading: 'What to weigh up', bullets: ['Annuities are long-term. Taking money out early can mean surrender charges', 'Withdrawals of earnings are taxed as ordinary income, and a 10% federal penalty can apply before age 59½', 'Optional income riders usually carry an annual cost', 'An annuity is one part of a plan, not the whole plan'] },
    ],
    questions: ['How much of my essential spending is covered by guaranteed income today?', 'How long would this money need to stay in the contract?', 'What does the contract guarantee, and what depends on performance?'],
    takeaway: 'An annuity is worth a look when you want part of your retirement money to be predictable.',
  },
  {
    slug: 'income-for-a-long-life', category: 'annuity', photo: 'commitment',
    title: 'Income for a long life',
    summary: 'Planning for the chance that retirement lasts 30 years or more.',
    intro: 'Living a long time is good news, and it is also a financial risk. The longer retirement lasts, the more years your savings must cover, and nobody knows their own number in advance.',
    sections: [
      { heading: 'Why longevity is a risk', body: ['A plan built to last until 85 can fall short if you live to 95. Rising prices, health costs and market drops all have more time to do damage over a long retirement.'] },
      { heading: 'How an annuity helps', bullets: ['Lifetime income keeps paying no matter how long you live', 'Joint options can continue income for a surviving spouse', 'A steady base of income can let the rest of your money stay invested', 'Some contracts offer income that can increase over time'] },
      { heading: 'What to weigh up', bullets: ['Once income starts, access to the lump sum is usually limited', 'Fixed payments lose buying power if prices rise', 'Guarantees depend on the claims-paying ability of the insurer'] },
    ],
    questions: ['If I live to 95, which of my income sources would still be paying?', 'How much monthly income do I need to cover the basics?', 'Should income cover one life or two?'],
    takeaway: 'Lifetime income turns an unknown, how long you will live, into something your plan can handle.',
  },
  {
    slug: 'steady-through-market-swings', category: 'annuity', photo: 'trust',
    title: 'Staying steady through market swings',
    summary: 'Why the years around retirement are the riskiest, and one way to protect them.',
    intro: 'A market drop hurts most when it arrives just before or just after you retire. You have less time to recover, and you may be taking withdrawals while values are down.',
    sections: [
      { heading: 'The timing problem', body: ['Two people can earn the same average return and end up in very different places, depending on when the bad years fall. Losses early in retirement, combined with withdrawals, can shorten how long savings last.'] },
      { heading: 'Where protection comes from', bullets: ['Fixed annuities credit a declared interest rate', 'Fixed indexed annuities link interest to a market index while protecting principal from index losses', 'Money held this way can be used for income in down years, so investments are not sold at a low'] },
      { heading: 'What to weigh up', bullets: ['Protection comes with limits on growth, such as caps or participation rates', 'These limits can change at renewal, within contract minimums', 'Early withdrawals above the free amount may carry charges'] },
    ],
    questions: ['How much of my portfolio could fall 20% without changing my plans?', 'Which money will I need in the first ten years of retirement?', 'What is the minimum this contract guarantees?'],
    takeaway: 'Protecting a portion of your savings can stop a bad market from becoming a bad retirement.',
  },
  {
    slug: 'fixed-indexed-annuities', category: 'annuity', photo: 'education',
    title: 'How a fixed indexed annuity works',
    summary: 'Growth linked to an index, with principal protected from index losses.',
    intro: 'A fixed indexed annuity sits between a fixed annuity and market investing. Your money is not invested in the market, but the interest you earn is based partly on how a market index performs.',
    sections: [
      { heading: 'How interest is credited', body: ['Each period, the insurer measures the change in an index such as the S&P 500. If the index rises, you are credited interest up to the limits in your contract. If it falls, you are credited zero for that period rather than taking the loss.'] },
      { heading: 'Terms you will see', bullets: ['Cap: the most interest you can earn in a period', 'Participation rate: the share of the index gain that counts', 'Spread: a percentage taken off the gain before crediting', 'Surrender period: the years during which early withdrawals carry a charge'] },
      { heading: 'What to weigh up', bullets: ['You will not receive the full index return, and dividends are not included', 'Caps and rates can be reset by the insurer at renewal', 'It is an insurance product, designed for the long term'] },
    ],
    questions: ['What are the current cap and participation rate, and what are the guaranteed minimums?', 'How long is the surrender period?', 'How much can I withdraw each year without a charge?'],
    takeaway: 'A fixed indexed annuity trades some upside for protection on the downside.',
  },
  {
    slug: 'deferred-annuities', category: 'annuity', photo: 'ownership',
    title: 'Deferred annuities: growing now, income later',
    summary: 'Setting money aside today for income that starts in the future.',
    intro: 'A deferred annuity has two stages. First your money grows. Later, when you choose, it can be turned into income. This suits money you will not need for several years.',
    sections: [
      { heading: 'The two stages', bullets: ['Accumulation: your premium earns interest, tax-deferred', 'Income: you take withdrawals, or convert the value to a stream of payments'] },
      { heading: 'Why people use them', bullets: ['No tax on growth until money is taken out', 'No annual contribution limit for non-qualified money, unlike an IRA or 401(k)', 'A choice of fixed, fixed indexed or variable designs', 'The option to create lifetime income later'] },
      { heading: 'What to weigh up', bullets: ['Earnings are taxed as ordinary income when withdrawn', 'A 10% federal penalty can apply to earnings taken before age 59½', 'Surrender charges apply in the early years'] },
    ],
    questions: ['When do I expect to need income from this money?', 'Have I used my other tax-advantaged accounts first?', 'What happens to the value if I die before taking income?'],
    takeaway: 'Deferral gives money time to grow before it has to start paying you.',
  },

  // ───────────── Life insurance ─────────────
  {
    slug: 'living-benefits', category: 'life', photo: 'our-mission',
    title: 'Living benefits: using a policy while you are alive',
    summary: 'How some life policies can pay out early for serious illness.',
    intro: 'Life insurance is usually thought of as money for others after you are gone. Many policies today can also pay part of the benefit to you, while living, if you become seriously ill.',
    sections: [
      { heading: 'How it works', body: ['An accelerated benefit rider lets you draw on a portion of the death benefit early if you meet the conditions in the policy. Whatever is paid early, plus any charges, is taken from what your beneficiaries later receive.'] },
      { heading: 'Common triggers', bullets: ['Terminal illness: a doctor certifies limited life expectancy', 'Chronic illness: you cannot perform everyday activities without help', 'Critical illness: a listed event such as a heart attack, stroke or cancer'] },
      { heading: 'What to weigh up', bullets: ['Riders, definitions and availability vary by insurer and state', 'Early payments reduce the death benefit, sometimes by more than the amount received', 'Payments may affect eligibility for public benefits, and tax treatment can vary'] },
    ],
    questions: ['Which living benefits does this policy include, and which cost extra?', 'How is the early payment calculated?', 'How much would be left for my family afterwards?'],
    takeaway: 'Living benefits let one policy protect both your family and you.',
  },
  {
    slug: 'life-insurance-and-retirement', category: 'life', photo: 'commitment',
    title: 'Life insurance in a retirement plan',
    summary: 'Why coverage can still matter after the paychecks stop.',
    intro: 'Many people assume life insurance is only for the working years. In retirement the reasons change, but they do not always disappear.',
    sections: [
      { heading: 'Why coverage may still be needed', bullets: ['A surviving spouse can lose one Social Security check and part of a pension', 'Final expenses and medical bills', 'Debts that outlast you, such as a mortgage', 'Leaving something to children, grandchildren or a cause'] },
      { heading: 'What permanent coverage offers', body: ['Permanent policies are designed to last for life and can build cash value over time. The death benefit generally passes to beneficiaries free of federal income tax.'] },
      { heading: 'What to weigh up', bullets: ['Permanent coverage costs more than term for the same death benefit', 'A policy must be funded properly to stay in force', 'Needs change, so coverage should be reviewed every few years'] },
    ],
    questions: ['What income would my spouse lose if I died first?', 'Does my current coverage end before I expect to need it?', 'What do I want to leave, and to whom?'],
    takeaway: 'Retirement changes what life insurance is for; it does not always remove the need.',
  },
  {
    slug: 'gifting-life-insurance', category: 'life', photo: 'partnership',
    title: 'Giving the gift of life insurance',
    summary: 'Starting a permanent policy for a child or grandchild.',
    intro: 'A permanent life policy bought for a child or grandchild is a gift that can last their whole life. It locks in coverage while they are young and healthy.',
    sections: [
      { heading: 'Why families do it', bullets: ['Premiums are lowest at young ages', 'Coverage is secured before any health problems appear', 'Cash value has decades to build', 'Some policies allow more coverage to be added later without new medical questions'] },
      { heading: 'How it is set up', body: ['An adult, usually a parent or grandparent, owns the policy and pays the premiums. Ownership can be transferred to the child once they are an adult.'] },
      { heading: 'What to weigh up', bullets: ['It is a long-term commitment to pay premiums', 'Cash value grows slowly in the early years', 'It is not a replacement for education savings; the two do different jobs', 'Large gifts can have gift-tax reporting rules, so ask a tax adviser'] },
    ],
    questions: ['Who will own the policy, and when would ownership pass on?', 'How long will premiums be paid?', 'Can coverage be increased later?'],
    takeaway: 'A policy started young can be one of the longest-lasting gifts a family gives.',
  },
  {
    slug: 'converting-term-insurance', category: 'life', photo: 'responsibility',
    title: 'Should you convert your term policy?',
    summary: 'Turning temporary coverage into permanent coverage without new health questions.',
    intro: 'Term insurance covers you for a set number of years. Many term policies include the right to convert to permanent coverage, and that right usually expires.',
    sections: [
      { heading: 'What conversion means', body: ['You exchange some or all of your term coverage for a permanent policy from the same insurer. No medical exam or health questions are required; the new policy uses the health rating you were given originally.'] },
      { heading: 'When it is worth considering', bullets: ['Your health has changed since you bought the policy', 'You now expect to need coverage for life', 'Your term period is close to ending', 'You want a policy that builds cash value'] },
      { heading: 'What to weigh up', bullets: ['Permanent premiums are higher and are based on your current age', 'Conversion deadlines differ by policy; check yours', 'You can often convert only part of the coverage to manage cost'] },
    ],
    questions: ['What is the last date I can convert?', 'Which permanent policies can I convert to?', 'What would it cost to convert half now?'],
    takeaway: 'The right to convert is valuable, and it has a deadline. Know the date.',
  },
  {
    slug: 'cash-value-in-retirement', category: 'life', photo: 'ownership',
    title: 'Using cash value in retirement',
    summary: 'How a permanent policy can add a flexible source of funds.',
    intro: 'Permanent life insurance can build cash value over the years. In retirement, that value can become another place to draw from, alongside savings and Social Security.',
    sections: [
      { heading: 'How cash value builds', body: ['Part of each premium goes toward the policy\'s cash value, which grows tax-deferred. How it grows depends on the type of policy: a declared rate, an index-linked formula, or underlying investments.'] },
      { heading: 'How it can be used', bullets: ['Policy loans and withdrawals can provide funds, generally without income tax if the policy is structured and managed correctly', 'It can be a source to draw on in years when markets are down', 'Whatever is not used remains part of the death benefit'] },
      { heading: 'What to weigh up', bullets: ['Loans and withdrawals reduce the cash value and the death benefit', 'If a policy lapses with a loan outstanding, tax can be due', 'This approach needs years of funding and regular review', 'Life insurance is protection first; it is not a retirement plan on its own'] },
    ],
    questions: ['How much cash value is projected, and what is guaranteed?', 'How would loans affect the death benefit?', 'How often will we review the policy?'],
    takeaway: 'Cash value can add flexibility in retirement when the policy is funded and looked after properly.',
  },
  {
    slug: 'preparing-for-your-medical-exam', category: 'life', photo: 'education',
    title: 'Getting ready for your insurance medical exam',
    summary: 'What to expect and how to prepare.',
    intro: 'Some life insurance applications include a short medical exam. It is paid for by the insurer, usually takes under half an hour, and can often be done at your home or office.',
    sections: [
      { heading: 'What happens', bullets: ['Height, weight, blood pressure and pulse', 'A blood sample and a urine sample', 'Questions about your health history and medications', 'Sometimes an ECG, depending on age and coverage amount'] },
      { heading: 'The day before', bullets: ['Drink plenty of water', 'Avoid alcohol and heavy exercise for 24 hours', 'Get a good night\'s sleep', 'Follow any fasting instructions you are given'] },
      { heading: 'On the day', bullets: ['Skip coffee and nicotine beforehand if you can', 'Have photo ID ready', 'Bring a list of medications, doctors and recent visits', 'Answer every question fully and truthfully'] },
    ],
    questions: ['Do I need to fast, and for how long?', 'Can I see a copy of my results?', 'How long until a decision is made?'],
    takeaway: 'A little preparation helps the exam reflect your normal health.',
  },
  {
    slug: 'mortgage-protection', category: 'life', photo: 'our-mission',
    title: 'Protecting your home with life insurance',
    summary: 'Making sure the mortgage can be paid if you are not there.',
    intro: 'For most families the mortgage is the largest monthly bill. Mortgage protection is life insurance arranged so your family could keep the home if you died.',
    sections: [
      { heading: 'How it works', body: ['You choose a coverage amount and term to match your mortgage. If you die during the term, the benefit is paid to the people you name, who decide how to use it.'] },
      { heading: 'Why a personal policy helps', bullets: ['Your family receives the money, not the lender', 'The benefit can stay level even as the loan balance falls', 'Coverage stays with you if you refinance or move', 'Some policies add living benefits or disability riders'] },
      { heading: 'What to weigh up', bullets: ['Cost depends on age, health, amount and term', 'Coverage that ends before the loan does leaves a gap', 'It should fit alongside any coverage you already have'] },
    ],
    questions: ['How many years are left on my mortgage?', 'Would my family want to pay off the loan or keep making payments?', 'Does my existing coverage already allow for the mortgage?'],
    takeaway: 'The right coverage means your family decides whether to stay in the home, not the bank.',
  },

  // ───────────── Disability insurance ─────────────
  {
    slug: 'protecting-your-income', category: 'disability', audience: 'Individuals', photo: 'responsibility',
    title: 'Protecting your paycheck',
    summary: 'What individual disability insurance does and why it matters.',
    intro: 'Your ability to earn an income is likely the most valuable thing you own. Disability insurance replaces part of that income if illness or injury stops you from working.',
    sections: [
      { heading: 'Why it matters', body: ['Most long absences from work are caused by illness, not accidents: back problems, cancer, heart conditions, mental health. Bills continue whether or not the paycheck does.'] },
      { heading: 'How a policy works', bullets: ['Benefit amount: the monthly payment, a percentage of your income', 'Elimination period: the waiting time before benefits start', 'Benefit period: how long payments can continue', 'Definition of disability: whether it is based on your own occupation or any occupation'] },
      { heading: 'What to weigh up', bullets: ['Policies replace part of income, not all of it', 'Premiums depend on age, health, occupation and options chosen', 'Benefits from a policy you pay for with after-tax money are generally received tax-free'] },
    ],
    questions: ['How long could I cover my bills without a paycheck?', 'How does this policy define being disabled?', 'Can coverage increase as my income grows?'],
    takeaway: 'Insure your income first; everything else in your plan depends on it.',
  },
  {
    slug: 'adding-to-group-coverage', category: 'disability', audience: 'Individuals', photo: 'transparency',
    title: 'Is your coverage at work enough?',
    summary: 'Filling the gaps in employer disability plans.',
    intro: 'Disability coverage through an employer is a good start. For many people, especially higher earners, it replaces less income than they expect.',
    sections: [
      { heading: 'Where the gaps are', bullets: ['Plans often cover around 60% of base salary only, leaving out bonuses and commissions', 'There is usually a monthly maximum', 'If your employer pays the premium, benefits are generally taxable', 'Coverage normally ends when you leave the job'] },
      { heading: 'How an individual policy helps', bullets: ['Adds income on top of the group benefit', 'You own it, so it goes with you if you change jobs', 'Benefits are generally tax-free when you pay the premium yourself', 'Terms cannot be changed by an employer'] },
      { heading: 'What to weigh up', bullets: ['Insurers limit the total coverage you can hold across all policies', 'You will need your group plan details to size the gap correctly'] },
    ],
    questions: ['What would my actual take-home be on my group benefit?', 'Are my bonuses or commissions covered?', 'What happens to my coverage if I leave my employer?'],
    takeaway: 'Check what your group plan would really pay; then decide whether the gap needs filling.',
  },
  {
    slug: 'protecting-retirement-savings', category: 'disability', audience: 'Individuals', photo: 'our-vision',
    title: 'Keeping retirement on track if you cannot work',
    summary: 'A disability can stop retirement saving as well as income.',
    intro: 'Disability benefits are designed to pay today\'s bills. They rarely leave room to keep saving for retirement, and employer contributions usually stop when you stop working.',
    sections: [
      { heading: 'The hidden cost', body: ['Years out of work mean years of missed contributions, missed employer matches and missed growth. Someone disabled at 45 could reach 65 with far less than they had planned.'] },
      { heading: 'How retirement protection works', bullets: ['A separate policy or rider pays a monthly amount if you are disabled', 'The money is directed to savings for retirement rather than daily expenses', 'It is designed to stand in for the contributions you and your employer would have made'] },
      { heading: 'What to weigh up', bullets: ['Availability and design vary by insurer', 'It is bought in addition to income protection, not instead of it', 'Amounts are based on what you currently contribute'] },
    ],
    questions: ['How much goes into my retirement accounts each year, including any match?', 'Would my income benefit leave anything to save?', 'How is the benefit held and paid?'],
    takeaway: 'Protecting contributions keeps a disability from costing you your retirement too.',
  },
  {
    slug: 'income-protection-for-owners', category: 'disability', audience: 'Business owners', photo: 'ownership',
    title: 'Income protection for business owners',
    summary: 'When the business depends on you, so does your income.',
    intro: 'Owners rarely have sick pay. If you cannot work, your personal income and the business that produces it can both be at risk at the same time.',
    sections: [
      { heading: 'Why owners are different', bullets: ['Income often varies from year to year', 'There may be no group plan to fall back on', 'Clients and staff rely on you personally', 'Personal and business finances are closely tied together'] },
      { heading: 'What to look for', bullets: ['A definition of disability based on your own occupation', 'Partial or residual benefits, so you can work reduced hours while recovering', 'The option to increase coverage as income grows', 'A policy that cannot be cancelled or repriced while you pay premiums'] },
      { heading: 'What to weigh up', bullets: ['Insurers will ask for tax returns or financial statements to verify income', 'Personal income protection does not cover business expenses; that needs separate coverage'] },
    ],
    questions: ['How would the insurer calculate my income?', 'Would I be paid if I could work part-time?', 'What would happen to the business if I were out for six months?'],
    takeaway: 'Protect your own income first, then protect the business around it.',
  },
  {
    slug: 'business-loan-protection', category: 'disability', audience: 'Business owners', photo: 'trust',
    title: 'Covering business loans during a disability',
    summary: 'Keeping up loan payments if an owner cannot work.',
    intro: 'Business loans are often personally guaranteed. If a disability cuts revenue, the payments are still due, and lenders can look to your personal assets.',
    sections: [
      { heading: 'How this coverage works', body: ['The policy pays a monthly benefit toward a specific loan obligation if the insured owner becomes disabled. Coverage is usually sized to the payment amount and the remaining term.'] },
      { heading: 'What it can cover', bullets: ['Practice or business acquisition loans', 'Equipment financing', 'Commercial property loans', 'Expansion or start-up borrowing'] },
      { heading: 'What to weigh up', bullets: ['Some lenders require this coverage as a condition of the loan', 'Benefits may be paid to the lender or to the business, depending on the design', 'It works alongside income protection and overhead cover; each does a different job'] },
    ],
    questions: ['Which of my loans are personally guaranteed?', 'How long do the payments have left to run?', 'Who would receive the benefit?'],
    takeaway: 'Loan protection keeps a health problem from turning into a default.',
  },
  {
    slug: 'overhead-expense-cover', category: 'disability', audience: 'Business owners', photo: 'transparency',
    title: 'Keeping the lights on: overhead expense cover',
    summary: 'Paying the business\'s bills while the owner recovers.',
    intro: 'When an owner is unable to work, revenue falls quickly, but rent, salaries and utilities do not. Overhead expense insurance reimburses those running costs so the business is still there to come back to.',
    sections: [
      { heading: 'What is typically covered', bullets: ['Rent or mortgage payments on business premises', 'Employee salaries and benefits', 'Utilities, insurance premiums and professional fees', 'Equipment leases and loan interest'] },
      { heading: 'How it works', body: ['Benefits reimburse actual expenses, up to a monthly limit, after a short waiting period. Benefit periods are short, commonly one to two years, because the purpose is to bridge a recovery or allow an orderly sale.'] },
      { heading: 'What to weigh up', bullets: ['The owner\'s own salary is generally not covered; that is the job of income protection', 'Premiums are usually deductible as a business expense, and benefits are then taxable to the business; confirm with a tax adviser', 'You will need a clear list of monthly fixed costs'] },
    ],
    questions: ['What does it cost to keep my doors open each month?', 'How long could the business run without me?', 'Which expenses would and would not be reimbursed?'],
    takeaway: 'Overhead cover buys time: to recover, or to make decisions without pressure.',
  },
  {
    slug: 'disability-buy-sell', category: 'disability', audience: 'Business owners', photo: 'partnership',
    title: 'Funding a buy-sell agreement for disability',
    summary: 'What happens to the business if a partner cannot return to work.',
    intro: 'Many partners plan for what happens if one of them dies. Fewer plan for a long-term disability, which is more likely during working years and can be harder on a business.',
    sections: [
      { heading: 'The problem', body: ['A disabled partner may no longer contribute but still owns a share and expects income from it. The working partners carry the load, and nobody has the cash to buy anyone out.'] },
      { heading: 'How a funded agreement helps', bullets: ['The buy-sell agreement sets out when a buyout is triggered and how the price is set', 'Disability buy-out insurance provides the money, as a lump sum, instalments or both', 'The disabled partner receives fair value; the remaining partners keep control'] },
      { heading: 'What to weigh up', bullets: ['The agreement and the policy must use matching definitions and timing', 'Waiting periods before a buyout are long, often a year or more', 'Business valuations should be kept up to date', 'An attorney should draft or review the agreement'] },
    ],
    questions: ['Does our agreement cover disability as well as death?', 'How is the business valued, and when was that last updated?', 'Where would the money for a buyout come from today?'],
    takeaway: 'An agreement without funding is only a promise; insurance turns it into a plan.',
  },
];

export const DISCLOSURE = 'This material is for general education only. It is not tax, legal or investment advice, and it is not an offer of any specific product. Product features, riders and availability vary by insurer and state. Guarantees are backed by the financial strength and claims-paying ability of the issuing insurance company. Please speak with your licensed professional and your tax or legal adviser about your own situation.';
