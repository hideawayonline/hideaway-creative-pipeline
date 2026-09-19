#!/usr/bin/env python3
"""Cart funnel window analysis for the 2026-09-19 audit.

Data pulled from Shopify ShopifyQL (sessions + sales tables), 27 Aug - 18 Sep 2026.
Kept here so the numbers in cart-funnel-audit-2026-09-19.md can be re-derived.
Run: python3 reports/cart_funnel_calc.py
"""
rows = [
("2026-08-27",8110,1277,576,154,14382.80,157),
("2026-08-28",13390,1974,906,136,11741.49,141),
("2026-08-29",7290,1056,478,74,6072.88,87),
("2026-08-30",6855,931,347,72,6443.82,74),
("2026-08-31",5839,711,272,61,6013.90,72),
("2026-09-01",4403,599,206,45,4041.08,46),
("2026-09-02",4496,690,282,79,6817.41,82),
("2026-09-03",4727,609,274,91,8463.42,104),
("2026-09-04",4193,534,279,77,6583.35,87),
("2026-09-05",3922,541,262,55,4658.04,58),
("2026-09-06",3961,480,248,57,4373.53,60),
("2026-09-07",3862,422,254,70,5866.62,76),
("2026-09-08",4989,496,274,70,6382.95,78),
("2026-09-09",3696,429,312,78,7115.51,83),
("2026-09-10",2957,329,230,69,6451.84,72),
("2026-09-11",3184,372,273,53,4854.21,60),
("2026-09-12",2532,287,226,59,5473.66,59),
("2026-09-13",2983,299,223,66,6089.70,69),
("2026-09-14",2526,211,188,50,4229.91,51),
("2026-09-15",2311,265,226,56,4910.58,62),
("2026-09-16",2548,238,200,65,6279.56,76),
("2026-09-17",2392,259,213,53,4603.78,54),
("2026-09-18",2417,281,223,59,5529.65,66),
]
print(f"{'date':11} {'sess':>6} {'ATC%':>6} {'C->CO%':>7} {'CO->Ord%':>8} {'CVR%':>6} {'rev':>9} {'ord':>4}")
print("-"*66)
for d,s,c,co,o,rev,ordc in rows:
    print(f"{d:11} {s:>6} {100*c/s:>6.2f} {100*co/c:>7.2f} {100*o/co:>8.2f} {100*o/s:>6.2f} {rev:>9.0f} {ordc:>4}")

def agg(label, sel):
    S=sum(r[1] for r in sel); C=sum(r[2] for r in sel); CO=sum(r[3] for r in sel)
    O=sum(r[4] for r in sel); R=sum(r[5] for r in sel); ORD=sum(r[6] for r in sel)
    n=len(sel)
    print(f"\n{label}  ({n} days)")
    print(f"  sessions/day {S/n:,.0f} | ATC {100*C/S:.2f}% | cart->checkout {100*CO/C:.2f}% | checkout->order {100*O/CO:.2f}% | CVR {100*O/S:.2f}%")
    print(f"  revenue/day ${R/n:,.0f} | orders/day {ORD/n:.1f} | AOV ${R/ORD:.2f} | rev/session ${R/S:.2f}")
    return dict(S=S,C=C,CO=CO,O=O,R=R,ORD=ORD,n=n)

print("\n"+"="*66)
a=agg("A: BASELINE new store pre-cart-build  27-29 Aug", rows[0:3])
b=agg("B: CART BUILD + SHIP PROTECTION ON    30 Aug-1 Sep", rows[3:6])
c=agg("C: PARTIAL RECOVERY                   2-8 Sep", rows[6:13])
d=agg("D: POST FREE-GIFT FIX                 9-18 Sep", rows[13:])

print("\n"+"="*66)
print("D vs B (the cart-broken window):")
for k,lab in [("ATC","add-to-cart rate"),]:
    pass
print(f"  cart->checkout  {100*b['CO']/b['C']:.1f}% -> {100*d['CO']/d['C']:.1f}%  ({100*d['CO']/d['C'] - 100*b['CO']/b['C']:+.1f}pp)")
print(f"  checkout->order {100*b['O']/b['CO']:.1f}% -> {100*d['O']/d['CO']:.1f}%  ({100*d['O']/d['CO'] - 100*b['O']/b['CO']:+.1f}pp)")
print(f"  add-to-cart     {100*b['C']/b['S']:.1f}% -> {100*d['C']/d['S']:.1f}%  ({100*d['C']/d['S'] - 100*b['C']/b['S']:+.1f}pp)")
print(f"  CVR             {100*b['O']/b['S']:.2f}% -> {100*d['O']/d['S']:.2f}%  ({100*(d['O']/d['S'])/(b['O']/b['S'])-100:+.0f}% relative)")
print(f"  rev/session     ${b['R']/b['S']:.2f} -> ${d['R']/d['S']:.2f}  ({100*(d['R']/d['S'])/(b['R']/b['S'])-100:+.0f}%)")
print(f"  sessions/day    {b['S']/b['n']:,.0f} -> {d['S']/d['n']:,.0f}  ({100*(d['S']/d['n'])/(b['S']/b['n'])-100:+.0f}%)")
print(f"  orders/day      {b['ORD']/b['n']:.1f} -> {d['ORD']/d['n']:.1f}  ({100*(d['ORD']/d['n'])/(b['ORD']/b['n'])-100:+.0f}%)")

print("\nD vs A (baseline before any cart change):")
print(f"  cart->checkout  {100*a['CO']/a['C']:.1f}% -> {100*d['CO']/d['C']:.1f}%")
print(f"  add-to-cart     {100*a['C']/a['S']:.1f}% -> {100*d['C']/d['S']:.1f}%")
print(f"  CVR             {100*a['O']/a['S']:.2f}% -> {100*d['O']/d['S']:.2f}%")
print(f"  rev/session     ${a['R']/a['S']:.2f} -> ${d['R']/d['S']:.2f}")

print("\n"+"="*66)
print("ABSOLUTE checkout-reached sessions per day (numerator check):")
for lab,sel in [("A 27-29 Aug",rows[0:3]),("B 30Aug-1Sep",rows[3:6]),("C 2-8 Sep",rows[6:13]),("D 9-18 Sep",rows[13:])]:
    n=len(sel)
    print(f"  {lab:14} carts/day {sum(r[2] for r in sel)/n:>6.0f}  checkouts/day {sum(r[3] for r in sel)/n:>6.0f}  orders/day {sum(r[4] for r in sel)/n:>5.0f}")
