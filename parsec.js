// ==UserScript==
// @name         Parsec - Browser Integration (User 7839310406)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Extract and search people data directly from browser - with API integration
// @author       Parsec
// @match        https://www.truepeoplesearch.com/*
// @match        https://www.whitepages.com/*
// @match        https://www.cyberbackgroundchecks.com/*
// @match        https://www.fastpeoplesearch.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        unsafeWindow
// @grant        window.close
// @connect      api.nicepricein.online
// @connect      ngrok-free.dev
// @connect      email-validator.net
// @connect      emailvalidation.io
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Debug: Confirm script is running
    console.log('[Parsec] Script execution started at:', new Date().toLocaleTimeString());
    console.log('[Parsec] Current URL:', window.location.href);

    // ============ API CONFIGURATION ============
    const API_CONFIG = {
        endpoint: 'https://api.nicepricein.online',
        token: 'fd1e07de19e8ee07aa85c4ac839dbfdec30f9da58055384bd1afca4abe3f2898',
        userId: '7839310406',
        username: 'DirLinuxs'
    };

    // Generated: 2025-12-09T09:32:50.284Z

    // ============ EMAIL VALIDATION CACHE ============
    // Cache stores validated emails to avoid re-checking
    const emailValidationCache = {};

    // ============ STORED DATA ============
    let extractedData = {
        fullName: '',
        firstName: '',
        lastName: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        emails: [],
        phones: [],
        primaryEmail: '',
        primaryPhone: ''
    };

    // ============ SEARCH RESULTS STORAGE ============
    // Store all search results for export (not just displayed ones)
    let allSearchResults = [];

    // ============ EMAIL CHECK PRICE (fetched from server) ============
    let emailCheckPrice = 0.5;  // Default price, will be updated from server

    // Function to fetch email check price from server
    async function fetchEmailCheckPrice() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${API_CONFIG.endpoint}/api/email-check-price`,
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.token}`,
                    'Content-Type': 'application/json'
                },
                onload: function(response) {
                    try {
                        const result = JSON.parse(response.responseText);
                        if (result.success) {
                            emailCheckPrice = result.price;
                            console.log(`[Parsec] Email check price: ${emailCheckPrice} coin(s)`);
                            resolve({ price: result.price, balance: result.userBalance });
                        } else {
                            console.warn('[Parsec] Failed to fetch email check price:', result.error);
                            resolve({ price: 0.5, balance: 0 });
                        }
                    } catch (e) {
                        console.error('[Parsec] Error parsing email check price:', e);
                        resolve({ price: 0.5, balance: 0 });
                    }
                },
                onerror: function(error) {
                    console.error('[Parsec] Error fetching email check price:', error);
                    resolve({ price: 0.5, balance: 0 });
                }
            });
        });
    }

    // ============ SITE CONFIGURATIONS ============
    const SITE_CONFIGS = {
        'truepeoplesearch.com': {
            name: 'TruePeopleSearch',
            pathCheck: () => window.location.pathname.includes('/find/person/'),
            // Helper to get JSON-LD data
            getJsonLdData: () => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of scripts) {
                    try {
                        const data = JSON.parse(script.textContent);
                        if (data['@type'] === 'ProfilePage' && data.mainEntity) {
                            return data.mainEntity;
                        }
                    } catch (e) {}
                }
                return null;
            },
            extractName: () => {
                // Method 1: JSON-LD (most reliable)
                const jsonLd = SITE_CONFIGS['truepeoplesearch.com'].getJsonLdData();
                if (jsonLd && jsonLd.name) {
                    return jsonLd.name;
                }
                // Method 2: DOM fallback
                const nameElement = document.querySelector('h1.oh1');
                return nameElement ? nameElement.textContent.trim() : '';
            },
            extractAKA: () => {
                const akaNames = [];
                // Method 1: JSON-LD
                const jsonLd = SITE_CONFIGS['truepeoplesearch.com'].getJsonLdData();
                if (jsonLd && jsonLd.alternateName) {
                    const altNames = Array.isArray(jsonLd.alternateName) ? jsonLd.alternateName : [jsonLd.alternateName];
                    altNames.forEach(name => {
                        if (name && typeof name === 'string') akaNames.push(name);
                    });
                }
                // Method 2: DOM fallback
                if (akaNames.length === 0) {
                    document.querySelectorAll('span[itemprop="alternateName"]').forEach(elem => {
                        const akaName = elem.textContent.trim();
                        if (akaName) akaNames.push(akaName);
                    });
                }
                return akaNames;
            },
            extractZips: () => {
                const zipCodes = new Set();
                // Method 1: JSON-LD (current address only)
                const jsonLd = SITE_CONFIGS['truepeoplesearch.com'].getJsonLdData();
                if (jsonLd && jsonLd.address && jsonLd.address.postalCode) {
                    zipCodes.add(jsonLd.address.postalCode);
                }
                // Method 2: DOM - all address links (current + previous)
                document.querySelectorAll('a[data-link-to-more="address"]').forEach(link => {
                    const text = link.textContent;
                    const match = text.match(/\b(\d{5})\b/);
                    if (match) zipCodes.add(match[1]);
                });
                // Method 3: Fallback - itemprop
                document.querySelectorAll('span[itemprop="postalCode"]').forEach(elem => {
                    const zip = elem.textContent.trim();
                    if (zip && /^\d{5}$/.test(zip)) {
                        zipCodes.add(zip);
                    }
                });
                return Array.from(zipCodes).sort();
            },
            extractCurrentAddress: () => {
                // Method 1: JSON-LD (most reliable)
                const jsonLd = SITE_CONFIGS['truepeoplesearch.com'].getJsonLdData();
                if (jsonLd && jsonLd.address) {
                    const addr = jsonLd.address;
                    return {
                        street: addr.streetAddress || '',
                        city: addr.addressLocality || '',
                        state: addr.addressRegion || '',
                        zip: addr.postalCode || ''
                    };
                }
                // Method 2: DOM fallback
                const container = document.querySelector('[data-link-to-more="address"]');
                if (container) {
                    const street = container.querySelector('span[itemprop="streetAddress"]');
                    const city = container.querySelector('span[itemprop="addressLocality"]');
                    const state = container.querySelector('span[itemprop="addressRegion"]');
                    const zip = container.querySelector('span[itemprop="postalCode"]');
                    return {
                        street: street ? street.textContent.trim() : '',
                        city: city ? city.textContent.trim() : '',
                        state: state ? state.textContent.trim() : '',
                        zip: zip ? zip.textContent.trim() : ''
                    };
                }
                return null;
            },
            extractEmails: () => {
                const emails = new Set();
                // Method 1: JSON-LD
                const jsonLd = SITE_CONFIGS['truepeoplesearch.com'].getJsonLdData();
                if (jsonLd && jsonLd.email) {
                    const emailList = Array.isArray(jsonLd.email) ? jsonLd.email : [jsonLd.email];
                    emailList.forEach(email => {
                        if (email && email.includes('@')) emails.add(email);
                    });
                }
                // Method 2: DOM fallback
                if (emails.size === 0) {
                    document.querySelectorAll('a[href^="mailto:"]').forEach(elem => {
                        const email = elem.textContent.trim();
                        if (email && email.includes('@')) emails.add(email);
                    });
                }
                return Array.from(emails);
            },
            extractPhones: () => {
                const phones = new Set();
                // Method 1: JSON-LD
                const jsonLd = SITE_CONFIGS['truepeoplesearch.com'].getJsonLdData();
                if (jsonLd && jsonLd.telephone) {
                    const phoneList = Array.isArray(jsonLd.telephone) ? jsonLd.telephone : [jsonLd.telephone];
                    phoneList.forEach(phone => {
                        if (phone && /\d{3}.*\d{3}.*\d{4}/.test(phone)) phones.add(phone);
                    });
                }
                // Method 2: DOM fallback
                if (phones.size === 0) {
                    document.querySelectorAll('span[itemprop="telephone"]').forEach(elem => {
                        const phone = elem.textContent.trim();
                        if (phone && /\d{3}.*\d{3}.*\d{4}/.test(phone)) phones.add(phone);
                    });
                }
                return Array.from(phones);
            }
        },

        'whitepages.com': {
            name: 'Whitepages',
            pathCheck: () => window.location.pathname.startsWith('/name/') || window.location.pathname.includes('/people-search'),
            extractName: () => {
                // Method 1: Look for JSON-LD structured data (most reliable)
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of jsonLdScripts) {
                    try {
                        const data = JSON.parse(script.textContent);
                        if (data['@type'] === 'Person' && data.name) {
                            return data.name;
                        }
                    } catch (e) {}
                }

                // Method 2: Try h1 with data-qa-selector (may have empty span, use strong for address)
                const h1 = document.querySelector('h1[data-qa-selector="big-name-in-header"]');
                if (h1) {
                    // Get text directly from h1, but exclude the address (which is in strong)
                    const clone = h1.cloneNode(true);
                    const strong = clone.querySelector('strong');
                    if (strong) strong.remove();
                    const br = clone.querySelector('br');
                    if (br) br.remove();
                    let text = clone.textContent.trim();
                    // Remove age suffix like "| 50s"
                    text = text.split('|')[0].trim();
                    if (text) return text;
                }

                // Method 3: Extract from page title
                const title = document.title;
                const match = title.match(/^([^|]+)/);
                if (match) {
                    let name = match[1].trim();
                    // Remove location part like "Pert Randy Lind" from "Pert Randy Lind | 50s | Old Dutch Rd..."
                    return name;
                }
                return '';
            },
            extractAKA: () => {
                const akaNames = [];
                const aliasSection = document.querySelector('div[data-qa-selector="person-aliases-desktop"]');
                if (aliasSection) {
                    const titleDiv = aliasSection.querySelector('.list-item--content--title div');
                    if (titleDiv) {
                        const names = titleDiv.textContent.split(',');
                        names.forEach(name => {
                            const trimmed = name.trim();
                            if (trimmed) akaNames.push(trimmed);
                        });
                    }
                }
                return akaNames;
            },
            extractZips: () => {
                const zipCodes = new Set();
                // Extract from current address in header
                const headerAddress = document.querySelector('h1[data-qa-selector="big-name-in-header"] strong');
                if (headerAddress) {
                    const match = headerAddress.textContent.match(/\b(\d{5})\b/);
                    if (match) zipCodes.add(match[1]);
                }
                // Extract from address cards
                const addressElements = document.querySelectorAll('.address-line2, [data-qa-selector="address-line2"]');
                addressElements.forEach(elem => {
                    const match = elem.textContent.match(/\b(\d{5})\b/);
                    if (match) zipCodes.add(match[1]);
                });
                return Array.from(zipCodes).sort();
            },
            extractCurrentAddress: () => {
                // Method 1: Try JSON-LD structured data first (most reliable)
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of jsonLdScripts) {
                    try {
                        const data = JSON.parse(script.textContent);
                        if (data['@type'] === 'Person' && data.homeLocation && data.homeLocation.address) {
                            const addr = data.homeLocation.address;
                            return {
                                street: addr.streetAddress || '',
                                city: addr.addressLocality || '',
                                state: addr.addressRegion || '',
                                zip: addr.postalCode || ''
                            };
                        }
                    } catch (e) {}
                }
                // Method 2: DOM selectors
                const addressLine1 = document.querySelector('.address-line1, [data-qa-selector="address-line1"]');
                const addressLine2 = document.querySelector('.address-line2, [data-qa-selector="address-line2"]');
                if (addressLine1 && addressLine2) {
                    const street = addressLine1.textContent.trim();
                    const cityStateZip = addressLine2.textContent.trim();
                    const match = cityStateZip.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
                    if (match) {
                        return {
                            street: street,
                            city: match[1].trim(),
                            state: match[2],
                            zip: match[3]
                        };
                    }
                }
                // Fallback from header
                const headerAddress = document.querySelector('h1[data-qa-selector="big-name-in-header"] strong');
                if (headerAddress) {
                    const text = headerAddress.textContent.trim();
                    const match = text.match(/(.+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
                    if (match) {
                        return {
                            street: match[1].trim(),
                            city: match[2].trim(),
                            state: match[3],
                            zip: match[4]
                        };
                    }
                }
                return null;
            },
            extractEmails: () => {
                // Whitepages usually hides emails, try to find visible ones
                const emails = new Set();
                document.querySelectorAll('a[href^="mailto:"], .email-address').forEach(elem => {
                    const email = elem.textContent.trim();
                    if (email && email.includes('@')) emails.add(email);
                });
                return Array.from(emails);
            },
            extractPhones: () => {
                const phones = new Set();
                // Method 1: Try JSON-LD structured data first
                const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                for (const script of jsonLdScripts) {
                    try {
                        const data = JSON.parse(script.textContent);
                        if (data['@type'] === 'Person' && data.contactPoint) {
                            data.contactPoint.forEach(cp => {
                                if (cp.telephone) {
                                    // Format: +1-706-868-9204 -> (706) 868-9204
                                    let phone = cp.telephone.replace(/^\+1-?/, '');
                                    if (phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
                                        phone = `(${phone.substr(0,3)}) ${phone.substr(4,3)}-${phone.substr(8,4)}`;
                                    }
                                    phones.add(phone);
                                }
                            });
                        }
                    } catch (e) {}
                }
                // Method 2: DOM selectors
                document.querySelectorAll('.phone-number, [data-qa-selector="phone-number"], a[href^="tel:"]').forEach(elem => {
                    const phone = elem.textContent.trim();
                    if (phone && /\d{3}.*\d{3}.*\d{4}/.test(phone)) phones.add(phone);
                });
                return Array.from(phones);
            }
        },

        'cyberbackgroundchecks.com': {
            name: 'CyberBackgroundChecks',
            pathCheck: () => window.location.pathname.includes('/detail/') || window.location.pathname.includes('/people/') || document.querySelector('span.name-given'),
            extractName: () => {
                // Primary: span.name-given (inside h1)
                const nameGiven = document.querySelector('span.name-given');
                if (nameGiven) return nameGiven.textContent.trim();
                // Fallback: h1.mb-0 content before age
                const h1 = document.querySelector('h1.mb-0, h1');
                if (h1) {
                    let text = h1.textContent.trim();
                    // Remove age part like "Age: 56"
                    text = text.replace(/Age:\s*\d+/gi, '').trim();
                    // Remove "in City, State" part
                    text = text.split(/\s+in\s+/i)[0].trim();
                    return text;
                }
                return '';
            },
            extractAKA: () => {
                const akaNames = [];
                // Find section with "Also Known As" or "Other observed names"
                const sectionLabels = document.querySelectorAll('.section-label, h2.section-label, h2');
                sectionLabels.forEach(label => {
                    const labelText = label.textContent.toLowerCase();
                    if (labelText.includes('also known') || labelText.includes('other observed') || labelText.includes('aka')) {
                        // Get parent container and find all name links/elements
                        let container = label.parentElement;
                        // Try to find h3 or .aka elements in siblings
                        const h3Elements = container.querySelectorAll('h3');
                        h3Elements.forEach(h3 => {
                            const name = h3.textContent.trim();
                            if (name && name.length > 2 && /^[A-Za-z\s'-]+$/.test(name)) {
                                akaNames.push(name);
                            }
                        });
                        // Also check for .aka class
                        const akaElements = container.querySelectorAll('.aka');
                        akaElements.forEach(elem => {
                            const name = elem.textContent.trim();
                            if (name && name.length > 2 && !akaNames.includes(name)) {
                                akaNames.push(name);
                            }
                        });
                    }
                });
                return akaNames;
            },
            extractZips: () => {
                const zipCodes = new Set();
                // Primary: a.address-current spans
                const addressElements = document.querySelectorAll('a.address-current');
                addressElements.forEach(elem => {
                    const text = elem.textContent;
                    const matches = text.match(/\b(\d{5})\b/g);
                    if (matches) matches.forEach(zip => zipCodes.add(zip.substring(0, 5)));
                });
                // Fallback: any address links
                document.querySelectorAll('a[href*="/address/"]').forEach(elem => {
                    const match = elem.textContent.match(/\b(\d{5})\b/);
                    if (match) zipCodes.add(match[1]);
                });
                return Array.from(zipCodes).sort();
            },
            extractCurrentAddress: () => {
                // Find the first address-current link (should be current address)
                const addressLink = document.querySelector('a.address-current');
                if (addressLink) {
                    const spans = addressLink.querySelectorAll('span.d-block');
                    if (spans.length >= 2) {
                        const street = spans[0].textContent.trim();
                        const cityStateZip = spans[1].textContent.trim();
                        // Parse "Advance, NC 27006 7667" -> city, state, zip
                        const match = cityStateZip.match(/([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
                        if (match) {
                            return {
                                street: street,
                                city: match[1].trim(),
                                state: match[2],
                                zip: match[3]
                            };
                        }
                    }
                    // Fallback: parse full text
                    const fullText = addressLink.textContent.replace(/\s+/g, ' ').trim();
                    const match = fullText.match(/(.+?)\s+([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
                    if (match) {
                        return {
                            street: match[1].trim(),
                            city: match[2].trim(),
                            state: match[3],
                            zip: match[4]
                        };
                    }
                }
                return null;
            },
            extractEmails: () => {
                const emails = new Set();
                // Find email links
                document.querySelectorAll('a[href^="mailto:"], a.email').forEach(elem => {
                    const email = elem.textContent.trim();
                    if (email && email.includes('@')) emails.add(email);
                });
                return Array.from(emails);
            },
            extractPhones: () => {
                const phones = new Set();
                // Find phone links - a.phone or a[href^="tel:"]
                document.querySelectorAll('a.phone, a[href^="tel:"]').forEach(elem => {
                    const phone = elem.textContent.trim();
                    if (phone && /\d{3}.*\d{3}.*\d{4}/.test(phone)) phones.add(phone);
                });
                return Array.from(phones);
            }
        },

        'fastpeoplesearch.com': {
            name: 'FastPeopleSearch',
            pathCheck: () => document.querySelector('h1#details-header') !== null || window.location.pathname.includes('/name/') || window.location.pathname.match(/_id_[A-Z0-9]+$/),
            extractName: () => {
                // Full name from span.fullname (e.g. "Randy Lind Pert")
                const fullnameSpan = document.querySelector('span.fullname');
                if (fullnameSpan) return fullnameSpan.textContent.trim();
                // Fallback: h1#details-header (first text node before <br>)
                const header = document.querySelector('h1#details-header');
                if (header) {
                    // Get first text node only (before "in City, State")
                    for (let node of header.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            const text = node.textContent.trim();
                            if (text && !text.startsWith('in')) return text;
                        }
                    }
                    // Fallback: split by " in "
                    const fullText = header.textContent;
                    const inIndex = fullText.indexOf(' in ');
                    if (inIndex > 0) return fullText.substring(0, inIndex).trim();
                }
                return '';
            },
            extractAKA: () => {
                const akaNames = [];
                // FastPeopleSearch shows AKA names as h3 elements in a section after "Also Known As"
                // Look for section with "Also Known As" or "AKA" heading
                const allH2 = document.querySelectorAll('h2');
                for (const h2 of allH2) {
                    if (h2.textContent.toLowerCase().includes('also known') || h2.textContent.toLowerCase().includes('aka')) {
                        // Get the next sibling elements with h3
                        let sibling = h2.nextElementSibling;
                        while (sibling) {
                            const h3s = sibling.querySelectorAll('h3');
                            h3s.forEach(h3 => {
                                const name = h3.textContent.trim();
                                if (name && name.length > 2) akaNames.push(name);
                            });
                            if (h3s.length > 0) break;
                            sibling = sibling.nextElementSibling;
                        }
                        break;
                    }
                }
                // Also try direct h3 elements with class that contains name-like text
                if (akaNames.length === 0) {
                    document.querySelectorAll('.detail-box-content h3, #aka-section h3').forEach(h3 => {
                        const name = h3.textContent.trim();
                        if (name && name.length > 2 && /^[A-Za-z\s'-]+$/.test(name)) {
                            akaNames.push(name);
                        }
                    });
                }
                return akaNames;
            },
            extractZips: () => {
                const zipCodes = new Set();
                // Search all links and text for ZIP codes
                const addressSelectors = [
                    '#current_address_section a',
                    '#previous-addresses a',
                    '.address-link a',
                    'a[href*="/address/"]',
                    'h3 a[href*="/address/"]'
                ];
                addressSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(elem => {
                        const match = elem.textContent.match(/\b(\d{5})\b/);
                        if (match) zipCodes.add(match[1]);
                    });
                });
                // Also check for ZIP in the header
                const header = document.querySelector('h1#details-header');
                if (header) {
                    const match = header.textContent.match(/\b(\d{5})\b/);
                    if (match) zipCodes.add(match[1]);
                }
                return Array.from(zipCodes).sort();
            },
            extractCurrentAddress: () => {
                // Try #current_address_section h3 a first
                const addressLink = document.querySelector('#current_address_section h3 a');
                if (addressLink) {
                    // Get innerHTML to see <br> tags
                    const html = addressLink.innerHTML;
                    // Format: "107 Old Dutch Rd<br>Advance NC 27006" or "107 Old Dutch Rd<br>\n      Advance NC 27006"
                    const parts = html.split(/<br\s*\/?>/i);
                    if (parts.length >= 2) {
                        const street = parts[0].trim();
                        const cityStateZip = parts[1].trim();
                        // Parse "Advance NC 27006" - city before state code
                        const match = cityStateZip.match(/(.+?)\s+([A-Z]{2})\s+(\d{5})/);
                        if (match) {
                            return {
                                street: street,
                                city: match[1].trim(),
                                state: match[2],
                                zip: match[3]
                            };
                        }
                    }
                    // Fallback: try comma-separated format
                    const text = addressLink.textContent.trim().replace(/\s+/g, ' ');
                    const commaMatch = text.match(/(.+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})/);
                    if (commaMatch) {
                        return {
                            street: commaMatch[1].trim(),
                            city: commaMatch[2].trim(),
                            state: commaMatch[3],
                            zip: commaMatch[4]
                        };
                    }
                }
                return null;
            },
            extractEmails: () => {
                const emails = new Set();
                // FastPeopleSearch: emails are in #email_section .detail-box-email h3
                const emailSection = document.querySelector('#email_section');
                if (emailSection) {
                    emailSection.querySelectorAll('.detail-box-email h3').forEach(h3 => {
                        const text = h3.textContent.trim();
                        if (text && text.includes('@') && !text.includes(' ')) {
                            emails.add(text);
                        }
                    });
                }
                // Fallback: any element with @ in text
                if (emails.size === 0) {
                    document.querySelectorAll('h3, a').forEach(elem => {
                        const text = elem.textContent.trim();
                        if (text && text.includes('@') && !text.includes(' ') && text.length < 50) {
                            emails.add(text);
                        }
                    });
                }
                return Array.from(emails);
            },
            extractPhones: () => {
                const phones = new Set();
                // FastPeopleSearch: phones are in #phone_number_section as links with href like "/336-692-0276"
                const phoneSection = document.querySelector('#phone_number_section');
                if (phoneSection) {
                    phoneSection.querySelectorAll('a[href^="/"]').forEach(link => {
                        const text = link.textContent.trim();
                        // Match phone format like (336) 692-0276 or (336)692-0276
                        if (/\(\d{3}\)\s*\d{3}-\d{4}/.test(text)) {
                            phones.add(text);
                        }
                    });
                }
                // Fallback: find all phone-like links on page
                if (phones.size === 0) {
                    document.querySelectorAll('a').forEach(link => {
                        const text = link.textContent.trim();
                        if (/\(\d{3}\)\s*\d{3}-\d{4}/.test(text)) {
                            phones.add(text);
                        }
                    });
                }
                return Array.from(phones);
            }
        }
    };

    // ============ UTILITY FUNCTIONS ============

    function getCurrentSite() {
        const hostname = window.location.hostname.replace('www.', '');
        for (const [domain, config] of Object.entries(SITE_CONFIGS)) {
            if (hostname.includes(domain) && config.pathCheck()) {
                return config;
            }
        }
        return null;
    }

    function isValidName(name) {
        if (!name || name.length < 2) return false;
        if (/^\d+$/.test(name)) return false;
        if (/^[^a-zA-Z]+$/.test(name)) return false;
        return true;
    }

    function parseFullName(fullName) {
        if (!fullName) return { firstName: '', lastName: '' };
        const parts = fullName.split(/\s+/).filter(part => isValidName(part));
        if (parts.length === 0) return { firstName: '', lastName: '' };
        return {
            firstName: parts[0],
            lastName: parts.length > 1 ? parts[parts.length - 1] : ''
        };
    }

    // Extract ALL addresses from page (current + previous) for matching
    function extractAllAddressesFromPage() {
        const addresses = new Set();
        const hostname = window.location.hostname.replace('www.', '');

        // TruePeopleSearch
        if (hostname.includes('truepeoplesearch.com')) {
            // Method 1: All address links (current + previous)
            document.querySelectorAll('a[data-link-to-more="address"]').forEach(link => {
                const text = link.textContent.trim();
                // Extract street part (before city) - format: "107 Old Dutch Rd\nAdvance, NC 27006"
                const lines = text.split('\n');
                if (lines.length > 0) {
                    const street = lines[0].trim();
                    if (street && /^\d+/.test(street)) addresses.add(street);
                }
            });
            // Method 2: Fallback - itemprop
            document.querySelectorAll('span[itemprop="streetAddress"]').forEach(el => {
                const addr = el.textContent.trim();
                if (addr) addresses.add(addr);
            });
        }

        // Whitepages
        if (hostname.includes('whitepages.com')) {
            document.querySelectorAll('.address-line1, [data-qa-selector="address-line1"]').forEach(el => {
                const addr = el.textContent.trim();
                if (addr) addresses.add(addr);
            });
            // Also from header
            const headerStrong = document.querySelector('h1[data-qa-selector="big-name-in-header"] strong');
            if (headerStrong) {
                const text = headerStrong.textContent.trim();
                const match = text.match(/^([^,]+)/);
                if (match) addresses.add(match[1].trim());
            }
        }

        // CyberBackgroundChecks
        if (hostname.includes('cyberbackgroundchecks.com')) {
            document.querySelectorAll('a.address-current span.d-block:first-child, a[href*="/address/"]').forEach(el => {
                let addr = el.textContent.trim();
                // Extract just street part (before city)
                const commaIndex = addr.indexOf(',');
                if (commaIndex > 0) addr = addr.substring(0, commaIndex).trim();
                // Remove city/state/zip if present
                addr = addr.replace(/\s+[A-Z]{2}\s+\d{5}.*$/, '').trim();
                if (addr && /^\d+/.test(addr)) addresses.add(addr);
            });
        }

        // FastPeopleSearch
        if (hostname.includes('fastpeoplesearch.com')) {
            document.querySelectorAll('#current_address_section a, #previous-addresses a, a[href*="/address/"]').forEach(el => {
                let addr = el.textContent.trim();
                // Extract just street part (before city)
                const commaIndex = addr.indexOf(',');
                if (commaIndex > 0) addr = addr.substring(0, commaIndex).trim();
                if (addr && /^\d+/.test(addr)) addresses.add(addr);
            });
        }

        return Array.from(addresses);
    }

    function extractData(siteConfig) {
        const fullName = siteConfig.extractName();
        const akaNames = siteConfig.extractAKA();
        const zipCodes = siteConfig.extractZips();
        const currentAddress = siteConfig.extractCurrentAddress ? siteConfig.extractCurrentAddress() : null;
        const emails = siteConfig.extractEmails ? siteConfig.extractEmails() : [];
        const phones = siteConfig.extractPhones ? siteConfig.extractPhones() : [];

        // Extract ALL addresses from page for matching (not just primary)
        const allAddresses = extractAllAddressesFromPage();
        window.extractedAllAddresses = allAddresses;
        console.log('[Parsec] All addresses found on page:', allAddresses);

        const firstNamesSet = new Set();
        const lastNamesSet = new Set();

        // Parse main name
        const mainName = parseFullName(fullName);
        if (mainName.firstName) firstNamesSet.add(mainName.firstName);
        if (mainName.lastName) lastNamesSet.add(mainName.lastName);

        // Parse AKA names
        akaNames.forEach(akaName => {
            const parsed = parseFullName(akaName);
            if (parsed.firstName) firstNamesSet.add(parsed.firstName);
            if (parsed.lastName) lastNamesSet.add(parsed.lastName);
        });

        const firstNames = Array.from(firstNamesSet).filter(isValidName);
        const lastNames = Array.from(lastNamesSet).filter(isValidName);

        // Store extracted data globally
        console.log('[Parsec] Extracted currentAddress:', currentAddress);
        console.log('[Parsec] Extracted phones:', phones);
        console.log('[Parsec] Extracted emails:', emails);

        extractedData = {
            fullName: fullName,
            firstName: firstNames[0] || '',
            lastName: lastNames[0] || '',
            address: currentAddress ? currentAddress.street : '',
            city: currentAddress ? currentAddress.city : '',
            state: currentAddress ? currentAddress.state : '',
            zip: currentAddress ? currentAddress.zip : '',
            emails: emails,
            phones: phones,
            primaryEmail: emails[0] || '',
            primaryPhone: phones[0] || ''
        };
        console.log('[Parsec] extractedData.address:', extractedData.address);

        return {
            firstNames,
            lastNames,
            zipCodes,
            currentAddress,
            emails,
            phones
        };
    }

    function formatQuery(data) {
        const col1 = data.firstNames.join(',') || '';
        const col2 = data.lastNames.join(',') || '';
        const col10 = data.zipCodes.join(',') || '';
        return `${col1}.${col2}.${col10}`;
    }

    function normalizeAddress(address) {
        if (!address) return '';
        return address.toLowerCase()
            .replace(/\./g, '')
            .replace(/,/g, '')
            .replace(/\s+/g, ' ')
            .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|circle|cir|place|pl)\b/gi, '')
            .trim();
    }

    // ============ END-TO-END ENCRYPTION ============
    // Encrypt sensitive data before sending to server (protects from ngrok/man-in-the-middle)

    async function encryptData(plaintext) {
        try {
            // Use API token as encryption key (derive 256-bit key from token)
            const encoder = new TextEncoder();
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                encoder.encode(API_CONFIG.token.substring(0, 32)), // Use first 32 chars as key
                { name: 'PBKDF2' },
                false,
                ['deriveBits', 'deriveKey']
            );

            const key = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: encoder.encode('csv-search-bot-salt-v1'),
                    iterations: 100000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt']
            );

            // Generate random IV (Initialization Vector)
            const iv = crypto.getRandomValues(new Uint8Array(12));

            // Encrypt data
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoder.encode(plaintext)
            );

            // Combine IV + encrypted data and encode as base64
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            console.error('[E2E Encryption] Error:', error);
            // Fallback: return plaintext if encryption fails (for compatibility)
            return plaintext;
        }
    }

    // Check if data is encrypted (starts with base64 IV+ciphertext)
    function isEncrypted(data) {
        if (typeof data !== 'string') return false;
        // Encrypted data is base64 and longer than 16 chars (IV = 12 bytes)
        try {
            return data.length > 20 && /^[A-Za-z0-9+/=]+$/.test(data);
        } catch {
            return false;
        }
    }

    // ============ API FUNCTIONS ============

    function performSearch(query, callback) {
        // Show loading indicator
        showLoading();

        console.log('[Parsec] Starting search for query:', query);
        console.log('[Parsec] API Endpoint:', API_CONFIG.endpoint);

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_CONFIG.endpoint}/api/search`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'ngrok-skip-browser-warning': 'true',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': window.location.origin,
                'Referer': window.location.href
            },
            data: JSON.stringify({ query }),
            onload: (response) => {
                console.log('[Parsec] Response status:', response.status);
                console.log('[Parsec] Response length:', response.responseText?.length || 0);
                console.log('[Parsec] Response headers:', response.getAllResponseHeaders?.());

                // Check for ngrok warning page
                if (response.responseText && response.responseText.includes('ngrok') && response.responseText.includes('<!DOCTYPE html>')) {
                    console.warn('[Parsec] Ngrok warning page detected');
                    callback(new Error('Ngrok warning page detected. Please visit the ngrok URL in a new tab first and click "Visit Site".'), null);
                    return;
                }

                // Check response status
                if (response.status !== 200) {
                    let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                    try {
                        const errorData = JSON.parse(response.responseText);
                        if (errorData.error) errorMsg = errorData.error;
                    } catch (e) {}
                    console.error('[Parsec] Server error:', errorMsg);
                    callback(new Error(errorMsg), null);
                    return;
                }

                try {
                    const data = JSON.parse(response.responseText);
                    console.log('[Parsec] Search success! Found', data.count, 'results');
                    if (!data.success) {
                        callback(new Error(data.error || 'Search failed'), null);
                        return;
                    }
                    callback(null, data);
                } catch (error) {
                    console.error('[Parsec] Parse error:', error);
                    console.error('[Parsec] Response text (first 500 chars):', response.responseText?.substring(0, 500));
                    callback(new Error('Failed to parse response. Check console for details.'), null);
                }
            },
            onerror: (error) => {
                console.error('[Parsec] Network error details:', error);
                console.error('[Parsec] Error type:', error.type);
                callback(new Error('Network error. Check your connection and ngrok tunnel.'), null);
            },
            ontimeout: () => {
                console.warn('[Parsec] Request timeout after 60s');
                callback(new Error('Request timeout (60s). The search might be taking longer than expected. Try again or check server logs.'), null);
            },
            timeout: 60000 // Increased to 60 seconds for large searches
        });
    }

    // ============ INSERT PERSON DATA ============
    function insertPersonData(callback) {
        console.log('[Parsec] Starting insert for extracted person data');
        console.log('[Parsec] API Endpoint:', API_CONFIG.endpoint);

        // Get first address from extracted data
        const currentAddress = extractedData.address || '';
        const city = extractedData.city || '';
        const state = extractedData.state || '';
        const zip = extractedData.zip || '';
        const firstName = extractedData.firstName || '';
        const lastName = extractedData.lastName || '';
        const phone = extractedData.primaryPhone || '';
        const email = extractedData.primaryEmail || '';

        // Validar datos mínimos
        if (!firstName || !lastName || !zip) {
            callback(new Error('Missing required data: first name, last name, and ZIP code'), null);
            return;
        }

        const personData = {
            first_name: firstName,
            last_name: lastName,
            address: currentAddress,
            city: city,
            state: state,
            zip: zip,
            phone: phone,
            source: 'parsec-extension'
        };

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_CONFIG.endpoint}/api/insert-person`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'ngrok-skip-browser-warning': 'true',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Origin': window.location.origin,
                'Referer': window.location.href
            },
            data: JSON.stringify({ query: personData }),
            onload: (response) => {
                console.log('[Parsec] Insert response status:', response.status);

                if (response.status !== 200) {
                    let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                    try {
                        const errorData = JSON.parse(response.responseText);
                        if (errorData.error) errorMsg = errorData.error;
                    } catch (e) {}
                    console.error('[Parsec] Insert error:', errorMsg);
                    callback(new Error(errorMsg), null);
                    return;
                }

                try {
                    const data = JSON.parse(response.responseText);
                    console.log('[Parsec] Insert success! Person ID:', data.personId);
                    if (!data.success) {
                        callback(new Error(data.error || 'Insert failed'), null);
                        return;
                    }
                    callback(null, data);
                } catch (error) {
                    console.error('[Parsec] Parse error:', error);
                    callback(new Error('Failed to parse response. Check console for details.'), null);
                }
            },
            onerror: (error) => {
                console.error('[Parsec] Network error details:', error);
                callback(new Error('Network error. Check your connection.'), null);
            },
            ontimeout: () => {
                console.warn('[Parsec] Request timeout after 30s');
                callback(new Error('Request timeout (30s). Try again.'), null);
            },
            timeout: 30000
        });
    }

    // ============ EMAIL VALIDATION (SERVER-SIDE via myemailverifier.com) ============

    // Validate email via server API (which calls myemailverifier.com)
    function checkEmailValidity(email, callback) {
        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_CONFIG.endpoint}/api/validate-email`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'ngrok-skip-browser-warning': 'true'
            },
            data: JSON.stringify({ email }),
            onload: (response) => {
                try {
                    const data = JSON.parse(response.responseText);

                    if (data.success === false && data.error) {
                        callback({
                            valid: false,
                            reason: data.error,
                            status: 'Error'
                        });
                        return;
                    }

                    // Map server response to UI format
                    callback({
                        valid: data.valid,
                        reason: data.reason || data.status,
                        status: data.status, // Valid, Invalid, Catch-all, Unknown
                        catchAll: data.catchAll,
                        disposable: data.disposable,
                        roleBased: data.roleBased,
                        freeDomain: data.freeDomain,
                        warning: data.disposable ? 'Disposable email detected' :
                                 data.catchAll ? 'Catch-all domain (may accept any address)' :
                                 data.roleBased ? 'Role-based email (info@, support@, etc.)' : null
                    });
                } catch (e) {
                    console.error('[Email Verify] Parse error:', e);
                    callback({
                        valid: false,
                        reason: 'Failed to parse server response',
                        status: 'Error'
                    });
                }
            },
            onerror: (error) => {
                console.error('[Email Verify] Request error:', error);
                callback({
                    valid: false,
                    reason: 'Network error',
                    status: 'Error'
                });
            },
            ontimeout: () => {
                callback({
                    valid: false,
                    reason: 'Request timeout',
                    status: 'Error'
                });
            },
            timeout: 20000 // 20 seconds timeout
        });
    }

    // ============ UI FUNCTIONS ============

    function copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            return success ? Promise.resolve() : Promise.reject();
        }
    }

    function togglePanel() {
        const container = document.getElementById('csv-search-container');
        const content = document.getElementById('csv-search-content');
        const toggleBtn = document.getElementById('csv-toggle-btn');

        if (!container || !content || !toggleBtn) return;

        const isExpanded = container.dataset.expanded === 'true';

        if (isExpanded) {
            container.style.height = '60px';
            content.style.display = 'none';
            toggleBtn.innerHTML = '▲';
            container.dataset.expanded = 'false';
        } else {
            const maxHeight = Math.floor(window.innerHeight * 0.7);
            container.style.height = maxHeight + 'px';
            content.style.display = 'block';
            toggleBtn.innerHTML = '▼';
            container.dataset.expanded = 'true';
        }
    }

    function showResults(results, count, truncated) {
        const content = document.getElementById('csv-search-content');
        const container = document.getElementById('csv-search-container');
        if (!content || !container) return;

        if (container.dataset.expanded !== 'true') {
            togglePanel();
        }

        // Limit: 40 result lines max in plugin. Each result = 2 display lines (User + Raw)
        // So 40 results = 80 display lines total
        const MAX_RESULTS = 40;
        const displayResults = results.slice(0, Math.min(MAX_RESULTS, 100));
        const shouldSendToTelegram = results.length > MAX_RESULTS;

        // Store ALL results globally for export (not just displayed ones)
        allSearchResults = results;

        // Note: Free email check status is now determined SERVER-SIDE
        // Server checks search_queries table for successful searches in last 30 minutes
        // This prevents client manipulation of the free status

        const sourceAddress = normalizeAddress(extractedData.address);
        console.log('[Parsec] Source address for matching:', extractedData.address, '-> normalized:', sourceAddress);

        // Auto-send to Telegram if too many results
        if (shouldSendToTelegram) {
            console.log(`[Parsec] Results (${results.length}) exceed limit (${MAX_RESULTS}). Auto-sending full results to Telegram...`);
            // We'll call sendToTelegram automatically after rendering
            setTimeout(() => {
                sendToTelegram();
            }, 500);
        }

        // Fetch email check price from server (async, will update button after load)
        fetchEmailCheckPrice().then(status => {
            const btn = document.getElementById('csv-validate-emails-btn');
            if (btn) {
                btn.textContent = `📧 Check Emails (💰 ${status.price} coin${status.price !== 1 ? 's' : ''})`;
            }
        });

        let html = `
            <div style="padding: 15px; height: 100%; overflow-y: auto; background: #1a1a2e;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #2ecc71;">
                        ✅ Found ${count} results (showing ${displayResults.length})
                        ${shouldSendToTelegram ? '<span style="color: #0088cc; font-size: 14px; margin-left: 10px;">📤 Full results sent to Telegram</span>' : ''}
                    </h3>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button id="csv-validate-emails-btn" style="
                            background: #9b59b6;
                            border: none;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                        ">📧 Check Emails (loading...)</button>
                        <button id="csv-send-telegram-btn" style="
                            background: #0088cc;
                            border: none;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                        ">📤 Send to Telegram</button>
                        <button id="csv-save-file-btn" style="
                            background: #27ae60;
                            border: none;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                        ">💾 Save to File</button>
                        <button id="csv-send-production-btn" style="
                            background: #8e44ad;
                            border: none;
                            color: white;
                            padding: 6px 12px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 11px;
                        ">🏭 GO Production</button>
                    </div>
                </div>
        `;

        // Mini Organizer
        html += createOrganizerHTML();

        if (displayResults.length > 0) {
            html += `<div style="font-family: 'Fira Code', monospace; font-size: 11px; line-height: 1.4;">`;
            displayResults.forEach((result, index) => {
                let parts = Array.isArray(result) ? result : (typeof result === 'string' ? result.split(',') : [result]);

                const formatDate = (dateStr) => {
                    if (!dateStr || dateStr.length !== 8) return dateStr;
                    return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}/${dateStr.substring(0, 4)}`;
                };

                const formatSSN = (ssnStr) => {
                    if (!ssnStr || ssnStr.length !== 9) return ssnStr;
                    return `${ssnStr.substring(0, 3)}-${ssnStr.substring(3, 5)}-${ssnStr.substring(5, 9)}`;
                };

                const firstName = parts[1] || '';
                const lastName = parts[2] || '';
                const dob = formatDate(parts[5] || '');
                const ssn = formatSSN(parts[19] || '');
                const address = parts[6] || '';
                const city = parts[7] || '';
                const state = parts[9] || '';
                const zip = parts[10] || '';

                // Check address match - simple logic: number + first letter after number
                // Example: "3055 Nc Highway 135" matches "3055 NC HWY 135" (both start with "3055 N")
                const resultAddressClean = address.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
                let isAddressMatch = false;

                // Get all addresses from the page (primary + all others) for matching
                const allSourceAddresses = [];
                if (extractedData.address) allSourceAddresses.push(extractedData.address);
                // Also check previous addresses if available
                if (window.extractedAllAddresses && window.extractedAllAddresses.length > 0) {
                    allSourceAddresses.push(...window.extractedAllAddresses);
                }

                // Debug: log on first result only
                if (index === 0) {
                    console.log('[Parsec] Address matching debug:');
                    console.log('  - Result address:', address, '-> clean:', resultAddressClean);
                    console.log('  - Source addresses:', allSourceAddresses);
                    console.log('  - extractedData.address:', extractedData.address);
                    console.log('  - window.extractedAllAddresses:', window.extractedAllAddresses);
                }

                for (const srcAddr of allSourceAddresses) {
                    if (!srcAddr) continue;
                    const sourceClean = srcAddr.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();

                    // Extract: number + first letter of street name
                    const sourceMatch = sourceClean.match(/^(\d+)\s*([A-Z])/);
                    const resultMatch = resultAddressClean.match(/^(\d+)\s*([A-Z])/);

                    if (index === 0) {
                        console.log('  - Comparing:', sourceClean, 'vs', resultAddressClean);
                        console.log('    sourceMatch:', sourceMatch, 'resultMatch:', resultMatch);
                    }

                    if (sourceMatch && resultMatch) {
                        // Compare: same number + same first letter
                        if (sourceMatch[1] === resultMatch[1] && sourceMatch[2] === resultMatch[2]) {
                            isAddressMatch = true;
                            if (index === 0) console.log('    MATCH FOUND!');
                            break;
                        }
                    }
                }

                // Only User: label turns green on address match (no row background)
                const userLabelStyle = isAddressMatch ? 'color: #2ecc71; font-weight: bold;' : 'color: #3498db;';

                const userFormat = `${firstName} ${lastName} ${dob} ${ssn} | ${address}, ${city}, ${state} ${zip}`;
                const adminFormat = Array.isArray(result) ? result.join(',') : result;

                // Data for click-to-organizer: DOB and SSN
                const clickData = JSON.stringify({ dob, ssn }).replace(/"/g, '&quot;');

                html += `<div class="csv-result-row" data-info="${clickData}" style="padding: 10px; border-bottom: 1px solid #333; cursor: pointer; transition: background 0.2s; ${index % 2 === 0 ? 'background-color: rgba(255,255,255,0.05);' : ''}"
                    onmouseover="this.style.backgroundColor='rgba(52,152,219,0.2)'"
                    onmouseout="this.style.backgroundColor='${index % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'}'">
                    <div style="margin-bottom: 5px; color: #ecf0f1;">
                        <strong style="${userLabelStyle}">User:</strong> ${userFormat}
                        <span style="float: right; color: #9b59b6; font-size: 10px;">📋 Click to add to Custom</span>
                    </div>
                    <div style="color: #888; font-size: 10px;">
                        <strong>Raw:</strong> ${adminFormat}
                    </div>
                </div>`;
            });
            html += `</div>`;
        }

        if (shouldSendToTelegram) {
            html += `
                <div style="margin-top: 15px; padding: 12px; background: rgba(0, 136, 204, 0.2); border-radius: 6px; color: #0088cc; border: 1px solid #0088cc;">
                    📤 <strong>Result too large for plugin display (${results.length} results).</strong><br>
                    Showing first ${MAX_RESULTS} results here. Full result has been automatically sent to your Telegram bot.
                </div>
            `;
        } else if (count > 100 || truncated) {
            html += `
                <div style="margin-top: 15px; padding: 12px; background: rgba(241, 196, 15, 0.2); border-radius: 6px; color: #f1c40f;">
                    ⚠️ Showing first 100 results. Download full file from bot for all ${count} results.
                </div>
            `;
        }

        html += `</div>`;
        content.innerHTML = html;

        // Attach event listeners
        attachOrganizerListeners();

        document.getElementById('csv-validate-emails-btn')?.addEventListener('click', showEmailValidationModal);
        document.getElementById('csv-send-telegram-btn')?.addEventListener('click', sendToTelegram);
        document.getElementById('csv-save-file-btn')?.addEventListener('click', saveToFile);
        document.getElementById('csv-send-production-btn')?.addEventListener('click', sendFileToProduction);
    }

    function createOrganizerHTML() {
        const { firstName, lastName, address, city, state, zip, primaryEmail, primaryPhone } = extractedData;
        const fullAddress = [address, city, state, zip].filter(Boolean).join(', ');

        return `
            <div id="csv-organizer" style="
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                color: white;
            ">
                <div style="font-weight: bold; margin-bottom: 10px; color: #3498db;">📋 Data Organizer</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px;">
                    <div>
                        <label style="color: #95a5a6; font-size: 10px;">PRIMARY NAME</label>
                        <input type="text" id="org-name" value="${firstName} ${lastName}" style="
                            width: 100%;
                            background: rgba(255,255,255,0.1);
                            border: 1px solid #555;
                            border-radius: 4px;
                            padding: 6px;
                            color: white;
                            font-size: 12px;
                        ">
                    </div>
                    <div>
                        <label style="color: #95a5a6; font-size: 10px;">CUSTOM FIELD</label>
                        <input type="text" id="org-custom" placeholder="Your notes..." style="
                            width: 100%;
                            background: rgba(255,255,255,0.1);
                            border: 1px solid #555;
                            border-radius: 4px;
                            padding: 6px;
                            color: white;
                            font-size: 12px;
                        ">
                    </div>
                </div>
                <div style="margin-top: 10px;">
                    <label style="color: #95a5a6; font-size: 10px;">PRIMARY ADDRESS</label>
                    <input type="text" id="org-address" value="${fullAddress}" style="
                        width: 100%;
                        background: rgba(255,255,255,0.1);
                        border: 1px solid #555;
                        border-radius: 4px;
                        padding: 6px;
                        color: white;
                        font-size: 12px;
                    ">
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px; align-items: center;">
                    <label style="display: flex; align-items: center; gap: 5px; color: #95a5a6; font-size: 11px;">
                        <input type="checkbox" id="org-include-email"> 📧 Email (${primaryEmail || 'N/A'})
                    </label>
                    <label style="display: flex; align-items: center; gap: 5px; color: #95a5a6; font-size: 11px;">
                        <input type="checkbox" id="org-include-phone"> 📱 Phone (${primaryPhone || 'N/A'})
                    </label>
                    <button id="org-copy-btn" style="
                        margin-left: auto;
                        background: #27ae60;
                        border: none;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 12px;
                    ">📋 Copy Line</button>
                    <button id="org-production-btn" style="
                        margin-left: 8px;
                        background: #8e44ad;
                        border: none;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-weight: bold;
                        font-size: 12px;
                    ">🏭 GO Production</button>
                </div>
            </div>
        `;
    }

    function attachOrganizerListeners() {
        const copyBtn = document.getElementById('org-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const name = document.getElementById('org-name')?.value || '';
                const custom = document.getElementById('org-custom')?.value || '';
                const address = document.getElementById('org-address')?.value || '';
                const includeEmail = document.getElementById('org-include-email')?.checked;
                const includePhone = document.getElementById('org-include-phone')?.checked;

                let parts = [name, custom, address].filter(Boolean);
                if (includeEmail && extractedData.primaryEmail) {
                    parts.push(extractedData.primaryEmail);
                }
                if (includePhone && extractedData.primaryPhone) {
                    parts.push(extractedData.primaryPhone);
                }

                const copyText = parts.join(' | ');
                copyToClipboard(copyText).then(() => {
                    copyBtn.innerHTML = '✅ Copied!';
                    copyBtn.style.background = '#2ecc71';
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋 Copy Line';
                        copyBtn.style.background = '#27ae60';
                    }, 2000);
                });
            });
        }

        // Send Line to Production button
        const productionBtn = document.getElementById('org-production-btn');
        if (productionBtn) {
            productionBtn.addEventListener('click', () => {
                const name = document.getElementById('org-name')?.value || '';
                const custom = document.getElementById('org-custom')?.value || '';
                const address = document.getElementById('org-address')?.value || '';
                const includeEmail = document.getElementById('org-include-email')?.checked;
                const includePhone = document.getElementById('org-include-phone')?.checked;

                let parts = [name, custom, address].filter(Boolean);
                if (includeEmail && extractedData.primaryEmail) {
                    parts.push(extractedData.primaryEmail);
                }
                if (includePhone && extractedData.primaryPhone) {
                    parts.push(extractedData.primaryPhone);
                }

                const lineText = parts.join(' | ');

                if (!lineText.trim()) {
                    showToast('❌ Nothing to send - fill in some data first');
                    return;
                }

                productionBtn.innerHTML = '⏳ Sending...';
                productionBtn.disabled = true;

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: `${API_CONFIG.endpoint}/api/send-to-production`,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${API_CONFIG.token}`,
                        'ngrok-skip-browser-warning': 'true'
                    },
                    data: JSON.stringify({ content: lineText }),
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.success) {
                                productionBtn.innerHTML = '✅ Sent!';
                                productionBtn.style.background = '#2ecc71';
                                showToast('✅ Line sent to production group!');
                            } else {
                                productionBtn.innerHTML = '❌ Error';
                                productionBtn.style.background = '#e74c3c';
                                // Check if production not configured
                                if (data.error && data.error.includes('not configured')) {
                                    showProductionInfoModal();
                                } else {
                                    showToast('❌ ' + (data.error || 'Failed to send'));
                                }
                            }
                        } catch (e) {
                            productionBtn.innerHTML = '❌ Error';
                            productionBtn.style.background = '#e74c3c';
                            showToast('❌ Failed to send to production');
                        }
                        setTimeout(() => {
                            productionBtn.innerHTML = '🏭 GO Production';
                            productionBtn.style.background = '#8e44ad';
                            productionBtn.disabled = false;
                        }, 2000);
                    },
                    onerror: () => {
                        productionBtn.innerHTML = '❌ Error';
                        productionBtn.style.background = '#e74c3c';
                        showToast('❌ Network error');
                        setTimeout(() => {
                            productionBtn.innerHTML = '🏭 GO Production';
                            productionBtn.style.background = '#8e44ad';
                            productionBtn.disabled = false;
                        }, 2000);
                    }
                });
            });
        }

        // Click on result row to add DOB/SSN to Custom field
        document.querySelectorAll('.csv-result-row').forEach(row => {
            row.addEventListener('click', () => {
                const dataStr = row.getAttribute('data-info');
                if (!dataStr) return;

                try {
                    const data = JSON.parse(dataStr.replace(/&quot;/g, '"'));
                    const customField = document.getElementById('org-custom');
                    if (customField) {
                        // Format: "DOB: 05/01/1969 SSN: 246-37-9931"
                        const parts = [];
                        if (data.dob) parts.push(`DOB: ${data.dob}`);
                        if (data.ssn) parts.push(`SSN: ${data.ssn}`);
                        customField.value = parts.join(' ');

                        // Visual feedback
                        customField.style.borderColor = '#2ecc71';
                        customField.style.boxShadow = '0 0 5px rgba(46,204,113,0.5)';
                        setTimeout(() => {
                            customField.style.borderColor = '#555';
                            customField.style.boxShadow = 'none';
                        }, 1500);
                    }
                } catch (e) {
                    console.error('[Parsec] Error parsing row data:', e);
                }
            });
        });
    }

    // Helper to format email status
    function formatEmailStatus(result) {
        let statusText = '';
        let statusColor = '#95a5a6';
        let borderColor = '#555';

        if (result.status === 'Valid') {
            if (result.warning) {
                statusText = `⚠️ Valid (${result.warning})`;
                statusColor = '#f39c12';
                borderColor = '#f39c12';
            } else {
                statusText = `✅ Valid - ${result.reason}`;
                statusColor = '#2ecc71';
                borderColor = '#2ecc71';
            }
        } else if (result.status === 'Catch-all') {
            statusText = `⚠️ Catch-all (accepts any)`;
            statusColor = '#f39c12';
            borderColor = '#f39c12';
        } else if (result.status === 'Unknown') {
            statusText = `❓ Unknown - ${result.reason}`;
            statusColor = '#95a5a6';
            borderColor = '#95a5a6';
        } else if (result.status === 'Invalid') {
            statusText = `❌ Invalid - ${result.reason}`;
            statusColor = '#e74c3c';
            borderColor = '#e74c3c';
        } else if (result.status === 'Error') {
            statusText = `⚠️ ${result.reason}`;
            statusColor = '#e67e22';
            borderColor = '#e67e22';
        } else {
            statusText = result.valid ? '✅ Valid' : `❌ ${result.reason || 'Invalid'}`;
            statusColor = result.valid ? '#2ecc71' : '#e74c3c';
            borderColor = statusColor;
        }

        return { statusText, statusColor, borderColor };
    }

    // Format email validation results for Telegram/Production
    function formatEmailReportForTelegram(results) {
        let report = `📧 EMAIL VALIDATION REPORT\n`;
        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `📅 Date: ${new Date().toLocaleString()}\n`;
        report += `📊 Total: ${results.results.length} emails\n\n`;

        if (results.stats) {
            report += `📈 SUMMARY:\n`;
            report += `✅ Valid: ${results.stats.valid || 0}\n`;
            report += `❌ Invalid: ${results.stats.invalid || 0}\n`;
            report += `⚠️ Catch-all: ${results.stats.catchAll || 0}\n`;
            report += `❓ Unknown: ${results.stats.unknown || 0}\n\n`;
        }

        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `📋 DETAILED RESULTS:\n\n`;

        results.results.forEach((r, idx) => {
            const statusIcon = r.valid ? '✅' : (r.status === 'Catch-all' ? '⚠️' : '❌');
            report += `${idx + 1}. ${r.email}\n`;
            report += `   ${statusIcon} ${r.status} - ${r.reason || 'N/A'}\n`;
            if (r.roleBased) report += `   📌 Role-based email\n`;
            if (r.freeDomain) report += `   🆓 Free domain\n`;
            report += `\n`;
        });

        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        report += `🔒 E2E Encrypted | Parsec`;

        return report;
    }

    function showEmailValidationModal() {
        const emails = extractedData.emails;
        if (emails.length === 0) {
            alert('No emails found on this page');
            return;
        }

        // Check if all emails are already cached
        const allCached = emails.every(email => emailValidationCache[email]);

        if (allCached) {
            // Show cached results immediately
            showCachedEmailResults(emails);
            return;
        }

        // Show payment modal first
        showEmailPaymentModal(emails);
    }

    function showCachedEmailResults(emails) {
        let modalHtml = `
            <div id="email-validation-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border-radius: 12px;
                padding: 20px;
                z-index: 100001;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                color: white;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #3498db;">📧 Email Validation (Cached)</h3>
                    <button id="close-email-modal" style="
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 20px;
                        cursor: pointer;
                    ">✕</button>
                </div>
                <div style="max-height: 300px; overflow-y: auto;">
        `;

        emails.forEach((email) => {
            const cached = emailValidationCache[email];
            const { statusText, statusColor, borderColor } = formatEmailStatus(cached);
            modalHtml += `
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    margin-bottom: 8px;
                    border-radius: 6px;
                    border-left: 3px solid ${borderColor};
                    cursor: pointer;
                    transition: background 0.2s;
                " class="email-row-cached" data-email="${email}" title="Click to use in Organizer">
                    <span style="font-family: monospace; font-size: 12px;">${email}</span>
                    <span style="color: ${statusColor}; font-size: 11px;">${statusText}</span>
                </div>
            `;
        });

        modalHtml += `
                </div>
                <div style="margin-top: 15px; color: #95a5a6; font-size: 11px;">
                    💾 Results from cache (no charge) | 👆 Click email to use in Organizer
                </div>
            </div>
            <div id="email-modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 100000;
            "></div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        document.getElementById('close-email-modal').addEventListener('click', () => {
            modalContainer.remove();
        });
        document.getElementById('email-modal-overlay').addEventListener('click', () => {
            modalContainer.remove();
        });

        // Add click handlers to set email as Primary in Organizer
        modalContainer.querySelectorAll('.email-row-cached').forEach(row => {
            row.addEventListener('click', function() {
                const email = this.dataset.email;
                // Update extractedData.primaryEmail
                extractedData.primaryEmail = email;
                // Update the checkbox label text
                const emailCheckbox = document.getElementById('org-include-email');
                if (emailCheckbox && emailCheckbox.parentElement) {
                    const wasChecked = emailCheckbox.checked;
                    emailCheckbox.parentElement.innerHTML = `<input type="checkbox" id="org-include-email" ${wasChecked ? 'checked' : ''}> 📧 Email (${email})`;
                }
                // Visual feedback
                this.style.background = 'rgba(46,204,113,0.3)';
                setTimeout(() => {
                    this.style.background = 'rgba(255,255,255,0.05)';
                }, 300);
                // Show notification
                showToast(`✅ Primary email set to "${email}"`);
            });
            // Hover effect
            row.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(52,152,219,0.2)';
            });
            row.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.05)';
            });
        });
    }

    // Simple toast notification
    function showToast(message) {
        const existing = document.getElementById('csv-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'csv-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2ecc71;
            color: white;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 100002;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    function showEmailPaymentModal(emails) {
        // First, get the price from server
        GM_xmlhttpRequest({
            method: 'GET',
            url: `${API_CONFIG.endpoint}/api/email-check-price`,
            headers: {
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'ngrok-skip-browser-warning': 'true'
            },
            onload: (response) => {
                try {
                    const data = JSON.parse(response.responseText);
                    if (data.success) {
                        displayPaymentModal(emails, data.price, data.userBalance);
                    } else {
                        alert('Failed to get price: ' + (data.error || 'Unknown error'));
                    }
                } catch (e) {
                    console.error('[Email Check] Error:', e);
                    alert('Failed to get price information');
                }
            },
            onerror: () => {
                alert('Network error getting price');
            }
        });
    }

    function displayPaymentModal(emails, price, balance) {
        // Limit to first 10 uncached emails
        const MAX_EMAILS = 10;
        const allUncached = emails.filter(email => !emailValidationCache[email]);
        const uncachedEmails = allUncached.slice(0, MAX_EMAILS);
        const skippedEmails = allUncached.length - uncachedEmails.length;
        const cachedEmails = emails.filter(email => emailValidationCache[email]);

        let modalHtml = `
            <div id="email-payment-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border-radius: 12px;
                padding: 20px;
                z-index: 100001;
                min-width: 400px;
                max-width: 500px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                color: white;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #3498db;">📧 Email Validation</h3>
                    <button id="close-payment-modal" style="
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 20px;
                        cursor: pointer;
                    ">✕</button>
                </div>

                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Emails to check:</span>
                        <span style="color: #3498db; font-weight: bold;">${uncachedEmails.length}</span>
                    </div>
                    ${skippedEmails > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Skipped (limit 10):</span>
                        <span style="color: #e67e22;">${skippedEmails}</span>
                    </div>
                    ` : ''}
                    ${cachedEmails.length > 0 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Already cached:</span>
                        <span style="color: #2ecc71;">${cachedEmails.length} (free)</span>
                    </div>
                    ` : ''}
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <span>Price:</span>
                        <span style="color: #f39c12; font-weight: bold;">${price} search${price > 1 ? 'es' : ''}</span>
                    </div>
                    <hr style="border: none; border-top: 1px solid #333; margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>Your balance:</span>
                        <span style="color: ${balance >= price ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">${balance} searches</span>
                    </div>
                </div>

                <div style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
        `;

        // Show only emails that will be checked (cached + first 10 uncached)
        const emailsToShow = [...cachedEmails, ...uncachedEmails];
        emailsToShow.forEach((email, idx) => {
            const isCached = emailValidationCache[email];
            modalHtml += `
                <div class="email-row-payment" data-email="${email}" style="
                    display: flex;
                    align-items: center;
                    padding: 8px 10px;
                    background: rgba(255,255,255,0.03);
                    margin-bottom: 4px;
                    border-radius: 6px;
                    border-left: 3px solid #f39c12;
                    font-size: 12px;
                    cursor: pointer;
                    transition: background 0.2s;
                " title="Click to use in Organizer">
                    <span style="font-family: monospace; flex: 1;">${email}</span>
                    <span style="color: ${isCached ? '#2ecc71' : '#f39c12'}; font-size: 11px;">${isCached ? '💾 Cached' : '⏳ Pending'}</span>
                </div>
            `;
        });

        modalHtml += `
                </div>

                <div style="margin: 10px 0; color: #95a5a6; font-size: 10px;">
                    👆 Click email to use in Organizer
                </div>

                ${balance >= price ? `
                <button id="pay-and-check-btn" style="
                    width: 100%;
                    padding: 12px;
                    background: linear-gradient(135deg, #9b59b6, #8e44ad);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                ">💳 Pay ${price} search${price > 1 ? 'es' : ''} & Check Emails</button>
                ` : `
                <div style="background: rgba(231,76,60,0.2); padding: 12px; border-radius: 8px; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #e74c3c;">❌ Insufficient balance</p>
                    <p style="margin: 0; font-size: 12px; color: #95a5a6;">Buy more searches or invite friends for +50 bonus searches!</p>
                </div>
                `}

                <div style="margin-top: 10px; color: #95a5a6; font-size: 10px; text-align: center;">
                    ℹ️ Results will be cached - no charge for re-checking same emails
                </div>
            </div>
            <div id="email-modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 100000;
            "></div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        document.getElementById('close-payment-modal').addEventListener('click', () => {
            modalContainer.remove();
        });
        document.getElementById('email-modal-overlay').addEventListener('click', () => {
            modalContainer.remove();
        });

        const payBtn = document.getElementById('pay-and-check-btn');
        if (payBtn) {
            payBtn.addEventListener('click', () => {
                modalContainer.remove();
                performPaidEmailCheck(emails);
            });
        }

        // Add click handlers for email rows in payment modal
        modalContainer.querySelectorAll('.email-row-payment').forEach(row => {
            row.addEventListener('click', function() {
                const email = this.dataset.email;
                extractedData.primaryEmail = email;
                const emailCheckbox = document.getElementById('org-include-email');
                if (emailCheckbox && emailCheckbox.parentElement) {
                    const wasChecked = emailCheckbox.checked;
                    emailCheckbox.parentElement.innerHTML = `<input type="checkbox" id="org-include-email" ${wasChecked ? 'checked' : ''}> 📧 Email (${email})`;
                }
                this.style.background = 'rgba(243,156,18,0.3)';
                setTimeout(() => {
                    this.style.background = 'rgba(255,255,255,0.03)';
                }, 300);
                showToast(`✅ Primary email set to "${email}"`);
            });
            row.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(243,156,18,0.2)';
            });
            row.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.03)';
            });
        });
    }

    function performPaidEmailCheck(emails) {
        // Filter out already cached emails and limit to 10
        const MAX_EMAILS = 10;
        const allUncached = emails.filter(email => !emailValidationCache[email]);
        const uncachedEmails = allUncached.slice(0, MAX_EMAILS);

        if (uncachedEmails.length === 0) {
            showCachedEmailResults(emails);
            return;
        }

        // Build email list HTML for loading modal
        let emailListHtml = '';
        emails.forEach(email => {
            const isCached = emailValidationCache[email];
            emailListHtml += `
                <div style="
                    display: flex;
                    align-items: center;
                    padding: 8px 10px;
                    background: rgba(255,255,255,0.05);
                    margin-bottom: 6px;
                    border-radius: 6px;
                    border-left: 3px solid #f1c40f;
                    transition: background 0.2s;
                    cursor: pointer;
                " class="email-row-loading" data-email="${email}" title="Click to use in Organizer">
                    <span style="font-family: monospace; font-size: 12px; flex: 1;">${email}</span>
                    <span style="color: ${isCached ? '#2ecc71' : '#f1c40f'}; font-size: 11px; margin-left: 10px;">${isCached ? '💾 Cached' : '⏳ Checking...'}</span>
                </div>
            `;
        });

        // Show loading modal with email list
        let loadingHtml = `
            <div id="email-loading-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border-radius: 12px;
                padding: 20px;
                z-index: 100001;
                min-width: 400px;
                max-width: 550px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                color: white;
                transition: all 0.3s ease;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #f1c40f;">⏳ Validating Emails...</h3>
                    <button id="minimize-loading-modal" style="
                        background: rgba(255,255,255,0.1);
                        border: none;
                        color: #95a5a6;
                        font-size: 14px;
                        padding: 5px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                    " title="Minimize">⬇️ Minimize</button>
                </div>

                <div id="loading-modal-content">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                        <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #333; border-top: 2px solid #9b59b6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        <span style="font-size: 12px; color: #95a5a6;">Checking ${uncachedEmails.length} email${uncachedEmails.length > 1 ? 's' : ''}... This may take a moment</span>
                    </div>

                    <div style="max-height: 250px; overflow-y: auto;">
                        ${emailListHtml}
                    </div>

                    <div style="margin-top: 15px; padding: 10px; background: rgba(155,89,182,0.1); border-radius: 6px; border-left: 3px solid #9b59b6;">
                        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 12px;">
                            <input type="checkbox" id="auto-send-telegram-checkbox" style="width: 16px; height: 16px; cursor: pointer;">
                            <span>📱 Auto-send results to Telegram when done</span>
                        </label>
                        <div style="margin-top: 5px; font-size: 10px; color: #95a5a6;">
                            If validation takes too long, enable this and minimize the window
                        </div>
                    </div>

                    <div style="margin-top: 10px; color: #95a5a6; font-size: 11px;">
                        👆 Click email to use in Organizer
                    </div>
                </div>
            </div>
            <div id="email-loading-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 100000;
                transition: opacity 0.3s ease;
            "></div>
            <div id="email-loading-minimized" style="
                display: none;
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #1a1a2e, #2d2d44);
                border-radius: 8px;
                padding: 12px 16px;
                z-index: 100001;
                box-shadow: 0 5px 20px rgba(0,0,0,0.4);
                color: white;
                cursor: pointer;
                border: 1px solid #9b59b6;
            ">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="display: inline-block; width: 16px; height: 16px; border: 2px solid #333; border-top: 2px solid #9b59b6; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span style="font-size: 12px;">⏳ Validating ${uncachedEmails.length} emails...</span>
                    <span style="font-size: 10px; color: #9b59b6;">Click to expand</span>
                </div>
            </div>
        `;

        const loadingContainer = document.createElement('div');
        loadingContainer.innerHTML = loadingHtml;
        document.body.appendChild(loadingContainer);

        // Add click handlers for email rows in loading modal
        loadingContainer.querySelectorAll('.email-row-loading').forEach(row => {
            row.addEventListener('click', function() {
                const email = this.dataset.email;
                extractedData.primaryEmail = email;
                const emailCheckbox = document.getElementById('org-include-email');
                if (emailCheckbox && emailCheckbox.parentElement) {
                    const wasChecked = emailCheckbox.checked;
                    emailCheckbox.parentElement.innerHTML = `<input type="checkbox" id="org-include-email" ${wasChecked ? 'checked' : ''}> 📧 Email (${email})`;
                }
                this.style.background = 'rgba(241,196,15,0.3)';
                setTimeout(() => {
                    this.style.background = 'rgba(255,255,255,0.05)';
                }, 300);
                showToast(`✅ Primary email set to "${email}"`);
            });
            row.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(241,196,15,0.2)';
            });
            row.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.05)';
            });
        });

        // Minimize/Expand functionality
        const modal = loadingContainer.querySelector('#email-loading-modal');
        const overlay = loadingContainer.querySelector('#email-loading-overlay');
        const minimized = loadingContainer.querySelector('#email-loading-minimized');
        const minimizeBtn = loadingContainer.querySelector('#minimize-loading-modal');

        minimizeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            minimized.style.display = 'block';
        });

        minimized.addEventListener('click', () => {
            modal.style.display = 'block';
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            minimized.style.display = 'none';
        });

        // Encrypt email list (E2E encryption)
        const encryptEmails = async () => {
            try {
                const emailsJson = JSON.stringify(uncachedEmails);
                const encryptedEmails = await encryptData(emailsJson);
                console.log('[Email Check] Emails encrypted, sending to server...');
                return encryptedEmails;
            } catch (e) {
                console.error('[Email Check] Encryption failed:', e);
                return null;
            }
        };

        encryptEmails().then(encryptedEmailData => {
            // Prepare request data
            const requestData = encryptedEmailData
                ? { emails: encryptedEmailData, encrypted: true }
                : { emails: uncachedEmails, encrypted: false };

            // Call paid validation endpoint (BULK - may take up to 5 minutes)
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${API_CONFIG.endpoint}/api/validate-emails-paid`,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_CONFIG.token}`,
                    'ngrok-skip-browser-warning': 'true',
                    'X-Encrypted': encryptedEmailData ? 'true' : 'false'
                },
                data: JSON.stringify(requestData),
                onload: (response) => {
                    // Check auto-send checkbox before removing container
                    const autoSendEnabled = loadingContainer.querySelector('#auto-send-telegram-checkbox')?.checked;
                    loadingContainer.remove();

                    try {
                        const data = JSON.parse(response.responseText);

                        if (data.success) {
                            // Cache all results
                            data.results.forEach(result => {
                                emailValidationCache[result.email] = result;
                            });

                            // Auto-send to Telegram if enabled
                            if (autoSendEnabled) {
                                showToast('📱 Auto-sending results to Telegram...');
                                setTimeout(() => {
                                    sendToTelegram();
                                }, 500);
                            }

                            // Show results with stats and report URLs
                            showEmailResultsModal(emails, data.charged, data.newBalance, data.stats, data.reportUrls);
                        } else if (response.status === 402) {
                            // Insufficient balance
                            alert(data.message || 'Insufficient balance');
                        } else {
                            alert('Error: ' + (data.error || 'Validation failed'));
                        }
                    } catch (e) {
                        console.error('[Email Check] Parse error:', e);
                        alert('Failed to parse response');
                    }
                },
                onerror: () => {
                    loadingContainer.remove();
                    alert('Network error during validation');
                },
                timeout: 360000 // 6 minutes for bulk validation
            });
        });
    }

    function showEmailResultsModal(emails, charged, newBalance, stats = null, reportUrls = null) {
        // Store results globally for integration with Send to Telegram / Production
        window.lastEmailValidationResults = {
            emails: emails,
            stats: stats,
            results: emails.map(email => emailValidationCache[email]).filter(Boolean),
            timestamp: new Date().toISOString()
        };

        // Build stats section if available
        let statsHtml = '';
        if (stats) {
            statsHtml = `
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <div style="background: rgba(46,204,113,0.2); padding: 8px 12px; border-radius: 6px; text-align: center; flex: 1; min-width: 60px;">
                        <div style="font-size: 18px; font-weight: bold; color: #2ecc71;">${stats.valid || 0}</div>
                        <div style="font-size: 10px; color: #95a5a6;">Valid</div>
                    </div>
                    <div style="background: rgba(231,76,60,0.2); padding: 8px 12px; border-radius: 6px; text-align: center; flex: 1; min-width: 60px;">
                        <div style="font-size: 18px; font-weight: bold; color: #e74c3c;">${stats.invalid || 0}</div>
                        <div style="font-size: 10px; color: #95a5a6;">Invalid</div>
                    </div>
                    <div style="background: rgba(241,196,15,0.2); padding: 8px 12px; border-radius: 6px; text-align: center; flex: 1; min-width: 60px;">
                        <div style="font-size: 18px; font-weight: bold; color: #f1c40f;">${stats.catchAll || 0}</div>
                        <div style="font-size: 10px; color: #95a5a6;">Catch-all</div>
                    </div>
                    <div style="background: rgba(149,165,166,0.2); padding: 8px 12px; border-radius: 6px; text-align: center; flex: 1; min-width: 60px;">
                        <div style="font-size: 18px; font-weight: bold; color: #95a5a6;">${stats.unknown || 0}</div>
                        <div style="font-size: 10px; color: #95a5a6;">Unknown</div>
                    </div>
                </div>
            `;
        }


        let modalHtml = `
            <div id="email-results-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border-radius: 12px;
                padding: 20px;
                z-index: 100001;
                min-width: 400px;
                max-width: 550px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                color: white;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #2ecc71;">✅ Email Validation Complete</h3>
                    <button id="close-results-modal" style="
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 20px;
                        cursor: pointer;
                    ">✕</button>
                </div>

                <div style="background: rgba(46,204,113,0.1); padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 12px;">
                    💳 Charged: ${charged} search${charged > 1 ? 'es' : ''} | New balance: ${newBalance} | 🔒 E2E Encrypted
                </div>

                ${statsHtml}

                <div style="max-height: 250px; overflow-y: auto;">
        `;

        emails.forEach((email) => {
            const result = emailValidationCache[email];
            if (result) {
                const { statusText, statusColor, borderColor } = formatEmailStatus(result);
                modalHtml += `
                    <div style="
                        display: flex;
                        align-items: center;
                        padding: 8px 10px;
                        background: rgba(255,255,255,0.05);
                        margin-bottom: 6px;
                        border-radius: 6px;
                        border-left: 3px solid ${borderColor};
                        transition: background 0.2s;
                        cursor: pointer;
                    " class="email-row-result" data-email="${email}" title="Click to use in Organizer">
                        <span style="font-family: monospace; font-size: 12px; flex: 1;">${email}</span>
                        <span style="color: ${statusColor}; font-size: 11px; margin-left: 10px;">${statusText}</span>
                    </div>
                `;
            }
        });

        modalHtml += `
                </div>
                <div id="email-footer-hint" style="margin-top: 15px; color: #95a5a6; font-size: 11px;">
                    👆 Click email to use in Organizer | 💾 Results cached
                </div>
            </div>
            <div id="email-modal-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 100000;
            "></div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        document.getElementById('close-results-modal').addEventListener('click', () => {
            modalContainer.remove();
        });
        document.getElementById('email-modal-overlay').addEventListener('click', () => {
            modalContainer.remove();
        });

        // Add click handlers to set email as Primary in Organizer
        modalContainer.querySelectorAll('.email-row-result').forEach(row => {
            row.addEventListener('click', function() {
                const email = this.dataset.email;
                // Update extractedData.primaryEmail
                extractedData.primaryEmail = email;
                // Update the checkbox label text
                const emailCheckbox = document.getElementById('org-include-email');
                if (emailCheckbox && emailCheckbox.parentElement) {
                    const wasChecked = emailCheckbox.checked;
                    emailCheckbox.parentElement.innerHTML = `<input type="checkbox" id="org-include-email" ${wasChecked ? 'checked' : ''}> 📧 Email (${email})`;
                }
                // Visual feedback
                this.style.background = 'rgba(46,204,113,0.3)';
                setTimeout(() => {
                    this.style.background = 'rgba(255,255,255,0.05)';
                }, 300);
                // Show notification
                showToast(`✅ Primary email set to "${email}"`);
            });
            // Hover effect
            row.addEventListener('mouseenter', function() {
                this.style.background = 'rgba(52,152,219,0.2)';
            });
            row.addEventListener('mouseleave', function() {
                this.style.background = 'rgba(255,255,255,0.05)';
            });
        });
    }

    // ============ COLLECT ALL DATA FOR EXPORT ============
    function collectAllData() {
        // Get organizer data
        const orgName = document.getElementById('org-name')?.value || '';
        const orgCustom = document.getElementById('org-custom')?.value || '';
        const orgAddress = document.getElementById('org-address')?.value || '';
        const includeEmail = document.getElementById('org-include-email')?.checked;
        const includePhone = document.getElementById('org-include-phone')?.checked;

        // Get search results from stored data (use ALL results, not just displayed)
        const searchResults = [];
        if (allSearchResults && allSearchResults.length > 0) {
            // Format all results for export
            allSearchResults.forEach(result => {
                let parts = Array.isArray(result) ? result : (typeof result === 'string' ? result.split(',') : [result]);

                const formatDate = (dateStr) => {
                    if (!dateStr || dateStr.length !== 8) return dateStr;
                    return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}/${dateStr.substring(0, 4)}`;
                };

                const formatSSN = (ssnStr) => {
                    if (!ssnStr || ssnStr.length !== 9) return ssnStr;
                    return `${ssnStr.substring(0, 3)}-${ssnStr.substring(3, 5)}-${ssnStr.substring(5, 9)}`;
                };

                const firstName = parts[1] || '';
                const lastName = parts[2] || '';
                const dob = formatDate(parts[5] || '');
                const ssn = formatSSN(parts[19] || '');
                const address = parts[6] || '';
                const city = parts[7] || '';
                const state = parts[9] || '';
                const zip = parts[10] || '';

                const userFormat = `${firstName} ${lastName} ${dob} ${ssn} | ${address}, ${city}, ${state} ${zip}`;
                searchResults.push(userFormat);
            });
        }

        // Get email validation results from cache (only add status if checked)
        const emailResults = [];
        extractedData.emails.forEach(email => {
            const cached = emailValidationCache[email];
            if (cached) {
                const { statusText } = formatEmailStatus(cached);
                emailResults.push(`• ${email} — ${statusText}`);
            } else {
                emailResults.push(`• ${email}`);
            }
        });

        // Format the complete data
        let content = '';
        content += '═══════════════════════════════════════\n';
        content += '        CSV SEARCH BOT - EXPORT DATA\n';
        content += '═══════════════════════════════════════\n';
        content += `Date: ${new Date().toLocaleString()}\n`;
        content += `Page: ${window.location.href}\n\n`;

        content += '──────────── ORGANIZER DATA ────────────\n';
        content += `Name: ${orgName}\n`;
        content += `Address: ${orgAddress}\n`;
        if (orgCustom) content += `Custom: ${orgCustom}\n`;
        if (includeEmail && extractedData.primaryEmail) {
            content += `Primary Email: ${extractedData.primaryEmail}\n`;
        }
        if (includePhone && extractedData.primaryPhone) {
            content += `Primary Phone: ${extractedData.primaryPhone}\n`;
        }
        content += '\n';

        if (emailResults.length > 0) {
            content += '──────────────── EMAILS ────────────────\n';
            emailResults.forEach(result => content += `${result}\n`);
            content += '\n';
        }

        if (extractedData.phones.length > 0) {
            content += '──────────────── PHONES ────────────────\n';
            extractedData.phones.forEach(phone => content += `• ${phone}\n`);
            content += '\n';
        }

        if (searchResults.length > 0) {
            content += '──────────── SEARCH RESULTS ────────────\n';
            content += `Total: ${searchResults.length} results\n\n`;
            searchResults.forEach((result, idx) => {
                content += `[${idx + 1}] ${result}\n`;
            });
        }

        content += '\n═══════════════════════════════════════\n';
        content += '  Generated by Parsec v3.0\n';
        content += '═══════════════════════════════════════\n';

        return content;
    }

    // ============ SEND TO TELEGRAM ============
    async function sendToTelegram() {
        const btn = document.getElementById('csv-send-telegram-btn');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '⏳ Encrypting & Sending...';
        }

        const data = collectAllData();

        // Encrypt sensitive data before sending (E2E encryption)
        const encryptedData = await encryptData(data);
        console.log('[E2E] Data encrypted, length:', encryptedData.length);

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_CONFIG.endpoint}/api/send-to-telegram`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'ngrok-skip-browser-warning': 'true',
                'X-Encrypted': 'true' // Flag to tell server data is encrypted
            },
            data: JSON.stringify({ data: encryptedData, encrypted: true }),
            onload: (response) => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '📤 Send to Telegram';
                }

                try {
                    const result = JSON.parse(response.responseText);
                    if (result.success) {
                        // Show success notification
                        showNotification('✅ Data sent to your Telegram bot!', 'success');
                    } else {
                        showNotification('❌ ' + (result.error || 'Failed to send'), 'error');
                    }
                } catch (e) {
                    console.error('[Send to Telegram] Error:', e);
                    showNotification('❌ Failed to parse response', 'error');
                }
            },
            onerror: () => {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '📤 Send to Telegram';
                }
                showNotification('❌ Network error', 'error');
            },
            timeout: 30000
        });
    }

    // ============ SAVE TO FILE ============
    function saveToFile() {
        const data = collectAllData();
        const filename = `search-data-${Date.now()}.txt`;

        // Create blob and download
        const blob = new Blob([data], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showNotification('✅ File downloaded: ' + filename, 'success');
    }

    // ============ SEND FILE TO PRODUCTION ============
    function sendFileToProduction() {
        const btn = document.getElementById('csv-send-production-btn');
        if (!btn) return;

        btn.innerHTML = '⏳ Sending...';
        btn.disabled = true;

        const data = collectAllData();
        const filename = `production-data-${Date.now()}.txt`;

        GM_xmlhttpRequest({
            method: 'POST',
            url: `${API_CONFIG.endpoint}/api/send-file-to-production`,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_CONFIG.token}`,
                'ngrok-skip-browser-warning': 'true'
            },
            data: JSON.stringify({ content: data, filename: filename }),
            onload: (response) => {
                try {
                    const result = JSON.parse(response.responseText);
                    if (result.success) {
                        btn.innerHTML = '✅ Sent!';
                        btn.style.background = '#2ecc71';
                        showNotification('✅ File sent to production group!', 'success');
                    } else {
                        btn.innerHTML = '❌ Error';
                        btn.style.background = '#e74c3c';
                        // Check if production not configured
                        if (result.error && result.error.includes('not configured')) {
                            showProductionInfoModal();
                        } else {
                            showNotification('❌ ' + (result.error || 'Failed to send'), 'error');
                        }
                    }
                } catch (e) {
                    console.error('[Send to Production] Error:', e);
                    btn.innerHTML = '❌ Error';
                    btn.style.background = '#e74c3c';
                    showNotification('❌ Failed to send to production', 'error');
                }
                setTimeout(() => {
                    btn.innerHTML = '🏭 GO Production';
                    btn.style.background = '#8e44ad';
                    btn.disabled = false;
                }, 2500);
            },
            onerror: (error) => {
                console.error('[Send to Production] Network error:', error);
                btn.innerHTML = '❌ Error';
                btn.style.background = '#e74c3c';
                showNotification('❌ Network error', 'error');
                setTimeout(() => {
                    btn.innerHTML = '🏭 GO Production';
                    btn.style.background = '#8e44ad';
                    btn.disabled = false;
                }, 2500);
            }
        });
    }

    // ============ PRODUCTION INFO MODAL ============
    function showProductionInfoModal() {
        const modalHtml = `
            <div id="production-info-modal" style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                border-radius: 16px;
                padding: 25px;
                z-index: 100001;
                min-width: 420px;
                max-width: 500px;
                box-shadow: 0 15px 50px rgba(0,0,0,0.6);
                color: white;
                border: 1px solid rgba(142, 68, 173, 0.3);
            ">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: #8e44ad; font-size: 18px;">🏭 Production Mode</h3>
                    <button id="close-production-info" style="
                        background: none;
                        border: none;
                        color: #888;
                        font-size: 22px;
                        cursor: pointer;
                    ">✕</button>
                </div>

                <div style="background: rgba(142, 68, 173, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 15px; border-left: 3px solid #8e44ad;">
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #ecf0f1;">
                        <strong>Production Mode</strong> lets you send search results directly to a Telegram group!
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #95a5a6;">
                        Perfect for teams - your colleagues will receive leads instantly without copy-pasting.
                    </p>
                </div>

                <div style="font-size: 13px; color: #bdc3c7; margin-bottom: 20px;">
                    <p style="margin: 0 0 8px 0;"><strong style="color: #3498db;">How to set up:</strong></p>
                    <ol style="margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li>Go to your personal bot in Telegram</li>
                        <li>Click <strong style="color: #8e44ad;">🏭 Production</strong> button</li>
                        <li>Add the bot to your team's group</li>
                        <li>Configure the group ID</li>
                        <li>Test the connection</li>
                    </ol>
                </div>

                <div style="background: rgba(46, 204, 113, 0.1); padding: 12px; border-radius: 8px; font-size: 12px; color: #2ecc71;">
                    💡 <strong>Tip:</strong> When you add the bot to a group, it will automatically send the Group ID!
                </div>
            </div>
            <div id="production-info-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.6);
                z-index: 100000;
            "></div>
        `;

        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHtml;
        document.body.appendChild(modalContainer);

        document.getElementById('close-production-info').addEventListener('click', () => {
            modalContainer.remove();
        });
        document.getElementById('production-info-overlay').addEventListener('click', () => {
            modalContainer.remove();
        });
    }

    // ============ NOTIFICATION HELPER ============
    function showNotification(message, type) {
        const bgColor = type === 'success' ? 'rgba(46, 204, 113, 0.95)' : 'rgba(231, 76, 60, 0.95)';

        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 100002;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function showError(message) {
        const content = document.getElementById('csv-search-content');
        const container = document.getElementById('csv-search-container');
        if (!content || !container) return;

        if (container.dataset.expanded !== 'true') {
            togglePanel();
        }

        content.innerHTML = `
            <div style="padding: 20px; background: #1a1a2e; height: 100%;">
                <h3 style="margin: 0 0 10px 0; color: #e74c3c;">❌ Error</h3>
                <p style="margin: 0; color: #ecf0f1;">${message}</p>
            </div>
        `;
    }

    function showLoading() {
        const content = document.getElementById('csv-search-content');
        const container = document.getElementById('csv-search-container');
        if (!content || !container) return;

        if (container.dataset.expanded !== 'true') {
            togglePanel();
        }

        content.innerHTML = `
            <div style="padding: 30px; text-align: center; background: #1a1a2e; height: 100%;">
                <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid #333; border-top: 4px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <p style="margin: 15px 0 0 0; color: #ecf0f1;">Searching database...</p>
            </div>
        `;
    }

    function addBookmarks() {
        const bookmarks = [
            { title: 'TruePeopleSearch', url: 'https://www.truepeoplesearch.com/' },
            { title: 'Whitepages', url: 'https://www.whitepages.com/' },
            { title: 'CyberBackgroundChecks', url: 'https://www.cyberbackgroundchecks.com/' },
            { title: 'FastPeopleSearch', url: 'https://www.fastpeoplesearch.com/' }
        ];

        // Create bookmarklet HTML
        const bookmarkHtml = bookmarks.map(b =>
            `<a href="${b.url}" style="
                display: block;
                padding: 8px 12px;
                background: rgba(255,255,255,0.1);
                margin-bottom: 5px;
                border-radius: 4px;
                color: #3498db;
                text-decoration: none;
                font-size: 12px;
            ">${b.title}</a>`
        ).join('');

        const modal = document.createElement('div');
        modal.innerHTML = `
            <div style="
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #1a1a2e;
                border-radius: 12px;
                padding: 20px;
                z-index: 100001;
                min-width: 300px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
                color: white;
            ">
                <h3 style="margin: 0 0 15px 0; color: #3498db;">🔖 Bookmarks</h3>
                <p style="color: #95a5a6; font-size: 11px; margin-bottom: 15px;">
                    Drag these links to your bookmarks bar:
                </p>
                ${bookmarkHtml}
                <button id="close-bookmarks-modal" style="
                    margin-top: 10px;
                    background: #e74c3c;
                    border: none;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    width: 100%;
                ">Close</button>
            </div>
            <div id="bookmarks-overlay" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 100000;
            "></div>
        `;
        document.body.appendChild(modal);

        document.getElementById('close-bookmarks-modal').addEventListener('click', () => modal.remove());
        document.getElementById('bookmarks-overlay').addEventListener('click', () => modal.remove());
    }

    function createPanel() {
        const siteConfig = getCurrentSite();
        if (!siteConfig) {
            console.log('[Parsec] Not on a supported profile page');
            return;
        }

        const data = extractData(siteConfig);
        const query = formatQuery(data);

        const container = document.createElement('div');
        container.id = 'csv-search-container';
        container.dataset.expanded = 'false';
        container.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 60px;
            background: #1a1a2e;
            z-index: 99999;
            font-family: 'Segoe UI', Arial, sans-serif;
            box-shadow: 0 -4px 20px rgba(0,0,0,0.4);
            transition: height 0.3s ease;
            display: flex;
            flex-direction: column;
        `;

        // Info line with emails/phones count
        const emailCount = data.emails.length;
        const phoneCount = data.phones.length;
        const contactInfo = [];
        if (emailCount > 0) contactInfo.push(`📧 ${emailCount}`);
        if (phoneCount > 0) contactInfo.push(`📱 ${phoneCount}`);
        const contactStr = contactInfo.length > 0 ? ` | ${contactInfo.join(' ')}` : '';

        container.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 12px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                min-height: 60px;
                box-sizing: border-box;
            ">
                <div style="flex: 1;">
                    <div style="font-size: 15px; font-weight: bold; display: flex; align-items: center; gap: 10px;">
                        🔍 Parsec v3.0 - ${siteConfig.name}
                        <span style="
                            background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%);
                            padding: 4px 10px;
                            border-radius: 12px;
                            font-size: 11px;
                            font-weight: bold;
                            box-shadow: 0 2px 8px rgba(46,204,113,0.4);
                        ">🔒 E2E ENCRYPTED</span>
                    </div>
                    <div style="font-size: 11px; opacity: 0.9; margin-top: 3px;">
                        User: ${API_CONFIG.username} | Query: <span style="font-family: monospace;">${query}</span>${contactStr}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button id="csv-bookmarks-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.4);
                        color: white;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                    ">🔖</button>
                    <button id="csv-copy-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.4);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        transition: all 0.2s;
                    ">📋 Copy</button>
                    <button id="csv-insert-btn" style="
                        background: rgba(52,152,219,0.8);
                        border: 1px solid rgba(52,152,219,1);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: bold;
                        transition: all 0.2s;
                    ">📥 Insert</button>
                    <button id="csv-search-btn" style="
                        background: rgba(46,204,113,0.8);
                        border: 1px solid rgba(46,204,113,1);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        font-weight: bold;
                        transition: all 0.2s;
                    ">🔍 Search</button>
                    <button id="csv-toggle-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: 1px solid rgba(255,255,255,0.4);
                        color: white;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                        font-weight: bold;
                        transition: all 0.2s;
                    ">▲</button>
                </div>
            </div>
            <div id="csv-search-content" style="
                flex: 1;
                overflow: hidden;
                display: none;
                background: #1a1a2e;
            "></div>
        `;

        document.body.appendChild(container);

        // Event handlers
        document.getElementById('csv-toggle-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            togglePanel();
        });

        document.getElementById('csv-bookmarks-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            addBookmarks();
        });

        document.getElementById('csv-copy-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(query).then(() => {
                const btn = e.target;
                const originalText = btn.innerHTML;
                btn.innerHTML = '✅ Copied!';
                btn.style.background = 'rgba(46,204,113,0.8)';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = 'rgba(255,255,255,0.2)';
                }, 2000);
            });
        });

        document.getElementById('csv-search-btn').addEventListener('click', (e) => {
            e.stopPropagation();

            performSearch(query, (error, data) => {
                if (error) {
                    showError(error.message);
                    return;
                }

                if (!data.success) {
                    showError(data.error || 'Search failed');
                    return;
                }

                showResults(data.results, data.count, data.truncated);
            });
        });

        document.getElementById('csv-insert-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = document.getElementById('csv-insert-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = '⏳ Inserting...';
            btn.disabled = true;

            insertPersonData((error, data) => {
                btn.disabled = false;
                if (error) {
                    btn.innerHTML = '❌ Error';
                    btn.style.background = 'rgba(231,76,60,0.8)';
                    showError(error.message);
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = 'rgba(52,152,219,0.8)';
                    }, 3000);
                    return;
                }

                if (!data.success) {
                    btn.innerHTML = '❌ Error';
                    btn.style.background = 'rgba(231,76,60,0.8)';
                    showError(data.error || 'Insert failed');
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.background = 'rgba(52,152,219,0.8)';
                    }, 3000);
                    return;
                }

                btn.innerHTML = `✅ ID: ${data.personId}`;
                btn.style.background = 'rgba(46,204,113,0.8)';
                showResults([data.data], 1, false);
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.style.background = 'rgba(52,152,219,0.8)';
                }, 3000);
            });
        });

        console.log(`[Parsec] Panel created for ${siteConfig.name}`);
        console.log('[Parsec] Extracted data:', extractedData);
    }

    // ============ STYLES ============

    GM_addStyle(`
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes fadeOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @keyframes pulse-secure {
            0%, 100% {
                box-shadow: 0 2px 8px rgba(46,204,113,0.4);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 4px 16px rgba(46,204,113,0.8);
                transform: scale(1.05);
            }
        }

        #csv-copy-btn:hover, #csv-search-btn:hover, #csv-toggle-btn:hover, #csv-bookmarks-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        }

        #csv-search-container * {
            box-sizing: border-box;
        }

        #csv-search-container input:focus {
            outline: none;
            border-color: #3498db;
        }
    `);

    // ============ INITIALIZATION ============

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(createPanel, 1000));
    } else {
        setTimeout(createPanel, 1000);
    }

    console.log('[Parsec] Browser Integration Active v3.0');
    console.log(`[Parsec] User: ${API_CONFIG.username} (ID: ${API_CONFIG.userId})`);

})();
