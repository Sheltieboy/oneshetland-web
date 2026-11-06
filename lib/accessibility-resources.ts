import type { ResourceSection } from "./accessibility";

/**
 * Links to authoritative information we do NOT hold or copy. Every address below answered when it was fetched on 6 Nov 2026
 * (a few were read only by title, and their descriptions say only what the title says). These are links, not endorsements:
 * none of these organisations is involved with OneShetland. Re-check before adding more; never paste their content here.
 */
export const RESOURCE_SECTIONS: ResourceSection[] = [
  { id: "travel", title: "Travel and assistance", blurb: "Ferries, flights and getting around. Each operator explains how to ask for help and how much notice they need.", items: [
    { title: "Accessibility support", by: "NorthLink Ferries", href: "https://www.northlinkferries.co.uk/travel/passenger-info/accessibility-support/", about: "Cabins, boarding help and advance-notice guidance for the Aberdeen, Orkney and Shetland ferries." },
    { title: "Accessibility policy", by: "NorthLink Ferries", href: "https://www.northlinkferries.co.uk/accessibility-policy/", about: "Their formal policy for terminals, vessels and assistance dogs." },
    { title: "Accessibility support", by: "Loganair", href: "https://www.loganair.co.uk/customer-support/accessibility-assistance-hub/", about: "How to arrange assistance for a flight." },
    { title: "Assistance and accessibility at Sumburgh Airport", by: "HIAL", href: "https://www.hial.co.uk/sumburgh-airport/assistance-accessibility-1", about: "Help at the airport. Assistance is booked through your airline." },
    { title: "Inter-island ferries: frequently asked questions", by: "Shetland Islands Council", href: "https://www.shetland.gov.uk/ferries/faq", about: "Answers about the council's inter-island ferries." },
    { title: "Shetland by bus", by: "ZetTrans", href: "https://www.zettrans.org.uk/travel/public-transport/bus", about: "Bus travel information from the regional transport partnership." },
    { title: "Shetland Community Transport", by: "Royal Voluntary Service", href: "https://www.royalvoluntaryservice.org.uk/find-help-support/search/shetland-hub/shetland-community-transport-46407000/", about: "Volunteer transport for people who find public transport difficult." },
  ] },
  { id: "visiting", title: "Visiting Shetland", blurb: "Guides written for visitors who want to plan around their own needs.", items: [
    { title: "Accessible Shetland", by: "Shetland.org", href: "https://www.shetland.org/visit/plan/getting-around/accessible-shetland", about: "Visitor overview, including an accessible accommodation filter and borrowable all-terrain wheelchairs." },
    { title: "Public toilets in Shetland", by: "Shetland.org", href: "https://www.shetland.org/visit/plan/getting-around/public-toilets-in-shetland", about: "An island-wide list of public toilets, including accessible ones." },
    { title: "All-terrain wheelchair routes", by: "Shetland.org", href: "https://www.shetland.org/blog/all-terrain-wheelchair-accessible-routes-shetland", about: "A blog post on routes suited to all-terrain wheelchairs." },
    { title: "Accessibility at Shetland Museum and Archives", by: "Shetland Museum and Archives", href: "https://www.shetlandmuseumandarchives.org.uk/visit/accessibility", about: "Access information for the museum." },
    { title: "Shetland Islands on Euan's Guide", by: "Euan's Guide", href: "https://www.euansguide.com/reviews/scotland/shetland-islands", about: "Disabled-access reviews written by visitors." },
    { title: "Changing Places toilet finder", by: "Changing Places", href: "https://www.changing-places.org/find", about: "A national map of Changing Places toilets." },
  ] },
  { id: "support", title: "Local support and services", blurb: "Organisations and council services for residents and visitors.", items: [
    { title: "Apply for a Blue Badge", by: "Shetland Islands Council", href: "https://www.shetland.gov.uk/transport/apply-blue-badge", about: "How to apply in Shetland." },
    { title: "Adults and older people", by: "Shetland Islands Council", href: "https://www.shetland.gov.uk/adults-older-people", about: "The council's adult social care services." },
    { title: "Shetland Islands Citizens Advice Bureau", by: "Citizens Advice", href: "https://www.shetlandcab.org.uk/", about: "Free, impartial and confidential advice." },
    { title: "Shetland Brain Health and Dementia Resource Centre", by: "Alzheimer Scotland", href: "https://www.alzscot.org/centre/shetland/", about: "The local resource centre." },
    { title: "Travelling for care", by: "NHS Shetland", href: "https://www.nhsshetland.scot/travelling-care", about: "Travelling to appointments, including travel help." },
    { title: "Ability Shetland", by: "Disability Information Scotland", href: "https://www.disabilityscot.org.uk/organisation/disability-shetland/", about: "A directory entry for Ability Shetland, which lends equipment such as all-terrain wheelchairs." },
  ] },
  { id: "info", title: "Helpful information", blurb: "National guidance that applies in Shetland.", items: [
    { title: "How to use a Blue Badge", by: "mygov.scot", href: "https://www.mygov.scot/how-to-use-blue-badge", about: "The rules for using a badge in Scotland." },
    { title: "If you cannot get a bus", by: "mygov.scot", href: "https://www.mygov.scot/transport-help/if-you-cannot-get-bus", about: "Alternatives such as community transport." },
    { title: "Accessible guide to the Scottish islands", by: "VisitBritain", href: "https://www.visitbritain.com/en/plan-your-trip/accessible-britain/accessible-guide-scottish-islands", about: "A general guide to accessible travel to the islands." },
  ] },
];
